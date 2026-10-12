import type { ActorContext } from '@/src/application/auth/actor-context';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import { newId } from '@/src/domain/shared/id';
import { deriveAgeProfile } from '@/src/domain/identity/experience';
import {
  reviewWindow,
  validateReflection,
  validateFocus,
  presentation,
  canEditReview,
  ReviewRuleError,
  type ReviewEntry,
  type ReviewPrompt,
  type ReviewStatus,
  type WeeklyReview,
} from '@/src/domain/weekly-review/review';
import type { ReviewRepository } from './review-repository';
export class ReviewDomainError extends Error {
  constructor(
    readonly code:
      | 'FORBIDDEN'
      | 'RESOURCE_NOT_FOUND'
      | 'STALE_VERSION'
      | 'RESOURCE_STATE_CHANGED'
      | 'DOMAIN_RULE_VIOLATION',
    message: string,
  ) {
    super(message);
    this.name = 'ReviewDomainError';
  }
}
function requireFamilyActor(
  actor: ActorContext,
): asserts actor is Exclude<ActorContext, { kind: 'SYSTEM' }> {
  if (actor.kind === 'SYSTEM')
    throw new ReviewDomainError('FORBIDDEN', 'A family session is required.');
}
function requireGuardian(
  actor: ActorContext,
): asserts actor is Extract<ActorContext, { kind: 'GUARDIAN' }> {
  if (actor.kind !== 'GUARDIAN')
    throw new ReviewDomainError('FORBIDDEN', 'Only guardians manage family reviews.');
}
function guarded<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ReviewRuleError)
      throw new ReviewDomainError('DOMAIN_RULE_VIOLATION', err.message);
    throw err;
  }
}
function author(actor: Exclude<ActorContext, { kind: 'SYSTEM' }>) {
  return actor.kind === 'CHILD'
    ? {
        authorKey: 'CHILD:' + actor.childId,
        authorKind: 'CHILD' as const,
        authorChildId: actor.childId,
        authorGuardianId: null,
      }
    : {
        authorKey: 'GUARDIAN:' + actor.guardianId,
        authorKind: 'GUARDIAN' as const,
        authorChildId: null,
        authorGuardianId: actor.guardianId,
      };
}
export class ReviewService {
  constructor(
    private readonly repo: ReviewRepository,
    private readonly identity: IdentityRepository,
  ) {}
  private async family(actor: ActorContext) {
    requireFamilyActor(actor);
    const family = await this.identity.getFamily(actor.familyId);
    if (!family) throw new ReviewDomainError('RESOURCE_NOT_FOUND', 'Family not found.');
    return family;
  }
  async start(actor: ActorContext, now = new Date()) {
    requireGuardian(actor);
    const family = await this.family(actor);
    return this.startForFamily(family.id, family.timezone, family.weeklyReviewDay, now);
  }
  private async startForFamily(familyId: string, timezone: string, day: number | null, now: Date) {
    const week = guarded(() => reviewWindow(currentDateInTimezone(timezone, now), day));
    await this.repo.abandonOlder(familyId, week.weekStart, now);
    const record: WeeklyReview = {
      id: newId<'WeeklyReviewId'>(),
      familyId,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      reviewOn: week.reviewOn,
      timezone,
      status: 'OPEN',
      nextFocus: null,
      version: 1,
      startedAt: now,
      finishedAt: null,
    };
    return this.repo.create(record);
  }
  async scheduleAll(now = new Date()) {
    const families = await this.repo.listFamilies();
    let created = 0,
      abandoned = 0;
    for (const f of families) {
      const period = reviewWindow(currentDateInTimezone(f.timezone, now), f.weeklyReviewDay);
      if (!(await this.repo.forWeek(f.id, period.weekStart))) created++;
      abandoned += await this.repo.abandonOlder(f.id, period.weekStart, now);
      // Unique family+week ensures a repeated scheduler tick does not reset the review.
      await this.startForFamily(f.id, f.timezone, f.weeklyReviewDay, now);
    }
    return { families: families.length, created, abandoned };
  }
  async saveEntry(
    actor: ActorContext,
    input: {
      reviewId: string;
      prompt: ReviewPrompt;
      text: string;
      expectedEntryVersion: number;
      now?: Date;
    },
  ) {
    requireFamilyActor(actor);
    const family = await this.family(actor);
    if (actor.kind === 'CHILD' && !(await this.identity.getChild(actor.familyId, actor.childId)))
      throw new ReviewDomainError('RESOURCE_NOT_FOUND', 'Child not found.');
    const review = await this.repo.lock(family.id, input.reviewId);
    if (!review) throw new ReviewDomainError('RESOURCE_NOT_FOUND', 'Review not found.');
    if (!canEditReview(review.status))
      throw new ReviewDomainError('RESOURCE_STATE_CHANGED', 'This weekly conversation is closed.');
    const text = guarded(() => validateReflection(input.text));
    const identity = author(actor);
    const old = await this.repo.entry(family.id, review.id, identity.authorKey, input.prompt);
    const expected = input.expectedEntryVersion;
    if (expected !== (old?.version ?? 0))
      throw new ReviewDomainError('STALE_VERSION', 'Reflection changed. Refresh before saving.');
    const next: ReviewEntry = {
      id: old?.id ?? newId<'ReviewEntryId'>(),
      familyId: family.id,
      reviewId: review.id,
      ...identity,
      prompt: input.prompt,
      text,
      version: expected + 1,
      updatedAt: input.now ?? new Date(),
    };
    const saved = old
      ? await this.repo.updateEntry(next, expected)
      : await this.repo.insertEntry(next);
    if (!saved)
      throw new ReviewDomainError('STALE_VERSION', 'Reflection changed on another device.');
    return { reviewId: review.id, entryId: next.id, version: next.version };
  }
  private async close(
    actor: ActorContext,
    input: {
      reviewId: string;
      expectedReviewVersion: number;
      status: 'COMPLETED' | 'SKIPPED';
      nextFocus?: string;
      now?: Date;
    },
  ) {
    requireGuardian(actor);
    const family = await this.family(actor);
    const review = await this.repo.lock(family.id, input.reviewId);
    if (!review) throw new ReviewDomainError('RESOURCE_NOT_FOUND', 'Review not found.');
    if (review.version !== input.expectedReviewVersion)
      throw new ReviewDomainError('STALE_VERSION', 'Review changed. Refresh before finishing.');
    if (!canEditReview(review.status))
      throw new ReviewDomainError('RESOURCE_STATE_CHANGED', 'Review already finished or skipped.');
    const focus =
      input.status === 'COMPLETED' ? guarded(() => validateFocus(input.nextFocus ?? '')) : null;
    const finished = await this.repo.transition(
      family.id,
      review.id,
      review.version,
      input.status,
      focus,
      input.now ?? new Date(),
    );
    if (!finished)
      throw new ReviewDomainError('STALE_VERSION', 'Review changed on another device.');
    return { reviewId: finished.id, status: finished.status, version: finished.version };
  }
  async complete(
    actor: ActorContext,
    input: { reviewId: string; expectedReviewVersion: number; nextFocus: string; now?: Date },
  ) {
    return this.close(actor, { ...input, status: 'COMPLETED' });
  }
  async skip(
    actor: ActorContext,
    input: { reviewId: string; expectedReviewVersion: number; now?: Date },
  ) {
    return this.close(actor, { ...input, status: 'SKIPPED' });
  }
  async current(actor: ActorContext, now = new Date()) {
    const family = await this.family(actor);
    const period = reviewWindow(
      currentDateInTimezone(family.timezone, now),
      family.weeklyReviewDay,
    );
    const review = await this.repo.forWeek(family.id, period.weekStart);
    if (!review)
      return {
        review: null,
        entries: [],
        summary: null,
        schedule: { ...period, timezone: family.timezone },
        presentation: 'CARD' as const,
      };
    const entries = await this.repo.entries(family.id, review.id);
    const scoped =
      actor.kind === 'CHILD'
        ? entries.filter((e) => e.authorKind === 'CHILD' && e.authorChildId === actor.childId)
        : entries;
    const summary = await this.repo.summary(
      family.id,
      review.weekStart,
      review.weekEnd,
      actor.kind === 'CHILD' ? actor.childId : null,
    );
    const child =
      actor.kind === 'CHILD' ? await this.identity.getChild(actor.familyId, actor.childId) : null;
    const profile = child
      ? deriveAgeProfile(child.birthDate, currentDateInTimezone(family.timezone, now))
      : null;
    return {
      review,
      entries: scoped,
      summary,
      schedule: {
        weekStart: review.weekStart,
        weekEnd: review.weekEnd,
        reviewOn: review.reviewOn,
        timezone: review.timezone,
      },
      presentation: presentation(profile),
    };
  }
}
