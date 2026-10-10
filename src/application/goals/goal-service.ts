import type { ActorContext } from '@/src/application/auth/actor-context';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import type { ActivityRepository } from '@/src/application/activity/activity-repository';
import { localDateInTimezone } from '@/src/domain/activity/schedule';
import { newId, type ChildId, type DomainEventId } from '@/src/domain/shared/id';
import {
  GoalRuleError,
  canAddProgress,
  canRevise,
  canTransition,
  displayGoalStatus,
  validateGoalCreation,
  type Goal,
  type GoalCategory,
  type GoalOwnerType,
  type StoredGoalStatus,
} from '@/src/domain/goals/goal';
import type { GoalRepository } from './goal-repository';

export class GoalDomainError extends Error {
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
    this.name = 'GoalDomainError';
  }
}
function requiredFamilyActor(
  actor: ActorContext,
): asserts actor is Exclude<ActorContext, { kind: 'SYSTEM' }> {
  if (actor.kind === 'SYSTEM') throw new GoalDomainError('FORBIDDEN', 'Family session required.');
}
function guardian(
  actor: ActorContext,
): asserts actor is Extract<ActorContext, { kind: 'GUARDIAN' }> {
  if (actor.kind !== 'GUARDIAN')
    throw new GoalDomainError('FORBIDDEN', 'Guardian approval required.');
}
function authorizeRead(actor: ActorContext, goal: Goal) {
  requiredFamilyActor(actor);
  if (
    goal.familyId !== actor.familyId ||
    (actor.kind === 'CHILD' && goal.ownerType === 'CHILD' && goal.ownerChildId !== actor.childId)
  )
    throw new GoalDomainError('RESOURCE_NOT_FOUND', 'Goal not found.');
}
function requiredVersion(goal: Goal, version: number | undefined) {
  if (version === undefined || version !== goal.version)
    throw new GoalDomainError('STALE_VERSION', 'Goal changed. Refresh and try again.');
}
function domainGuard(action: () => void) {
  try {
    action();
  } catch (error) {
    if (error instanceof GoalRuleError)
      throw new GoalDomainError('DOMAIN_RULE_VIOLATION', error.message);
    throw error;
  }
}

export class GoalService {
  constructor(
    private readonly repository: GoalRepository,
    private readonly identity: IdentityRepository,
    private readonly events: Pick<ActivityRepository, 'appendDomainEvent'>,
  ) {}

  private async appendEvent(input: {
    familyId: string;
    type: string;
    goalId: string;
    occurredAt: Date;
    recordedAt: Date;
    payload: Record<string, unknown>;
  }) {
    await this.events.appendDomainEvent({
      id: newId<'DomainEventId'>() as DomainEventId,
      familyId: input.familyId as Goal['familyId'] & never,
      type: input.type,
      aggregateType: 'Goal',
      aggregateId: input.goalId,
      occurredAt: input.occurredAt,
      recordedAt: input.recordedAt,
      payload: input.payload,
    });
  }
  private async actorFamily(actor: ActorContext) {
    requiredFamilyActor(actor);
    const family = await this.identity.getFamily(actor.familyId);
    if (!family) throw new GoalDomainError('RESOURCE_NOT_FOUND', 'Family not found.');
    return family;
  }
  private async locked(actor: ActorContext, id: string, version: number | undefined) {
    requiredFamilyActor(actor);
    const goal = await this.repository.lockGoal(actor.familyId, id);
    if (!goal) {
      throw new GoalDomainError('RESOURCE_NOT_FOUND', 'Goal not found.');
    }
    authorizeRead(actor, goal);
    requiredVersion(goal, version);
    return goal;
  }

  async create(
    actor: ActorContext,
    input: {
      ownerType: GoalOwnerType;
      ownerChildId: string | null;
      category: GoalCategory;
      title: string;
      why: string;
      nextStep: string;
      target: number;
      targetDate: string | null;
      occurredAt: Date;
      now?: Date;
    },
  ) {
    const family = await this.actorFamily(actor);
    domainGuard(() => validateGoalCreation(input));
    if (
      input.ownerType === 'CHILD' &&
      !(await this.identity.getChild(family.id, input.ownerChildId as ChildId))
    )
      throw new GoalDomainError('RESOURCE_NOT_FOUND', 'Child not found.');
    if (
      actor.kind === 'CHILD' &&
      (input.ownerType !== 'CHILD' || input.ownerChildId !== actor.childId)
    )
      throw new GoalDomainError('FORBIDDEN', 'Children can only propose their own personal goals.');
    // The autonomy module is not implemented: no age-derived right to skip approval.
    const status: StoredGoalStatus = actor.kind === 'CHILD' ? 'AWAITING_APPROVAL' : 'ACTIVE';
    const now = input.now ?? new Date();
    const goal: Goal = {
      id: newId<'GoalId'>(),
      familyId: family.id,
      ownerType: input.ownerType,
      ownerChildId: input.ownerChildId,
      proposedByChildId: actor.kind === 'CHILD' ? actor.childId : null,
      category: input.category,
      title: input.title.trim(),
      why: input.why.trim(),
      nextStep: input.nextStep.trim(),
      target: input.target,
      progress: 0,
      targetDate: input.targetDate,
      status,
      version: 1,
      createdAt: now,
    };
    await this.repository.insertGoal(goal);
    await this.appendEvent({
      familyId: family.id,
      type: 'GoalCreated',
      goalId: goal.id,
      occurredAt: input.occurredAt,
      recordedAt: now,
      payload: {
        ownerType: goal.ownerType,
        ownerChildId: goal.ownerChildId,
        status,
      },
    });
    return goal;
  }

  async transition(
    actor: ActorContext,
    input: {
      id: string;
      to: 'ACTIVE' | 'PAUSED' | 'ACHIEVED' | 'CLOSED';
      expectedVersion?: number;
      occurredAt: Date;
      now?: Date;
    },
  ) {
    guardian(actor);
    const goal = await this.locked(actor, input.id, input.expectedVersion);
    domainGuard(() => canTransition(goal, input.to));
    const now = input.now ?? new Date();
    const updated = await this.repository.updateGoal({
      familyId: actor.familyId,
      id: goal.id,
      expectedVersion: goal.version,
      patch: { status: input.to },
      updatedAt: now,
    });
    if (!updated) throw new GoalDomainError('STALE_VERSION', 'Goal updated elsewhere.');
    await this.appendEvent({
      familyId: actor.familyId,
      type: 'GoalStatusChanged',
      goalId: goal.id,
      occurredAt: input.occurredAt,
      recordedAt: now,
      payload: { from: goal.status, to: input.to },
    });
    return updated;
  }

  async addProgress(
    actor: ActorContext,
    input: {
      id: string;
      amount: number;
      step: string;
      expectedVersion?: number;
      occurredAt: Date;
      now?: Date;
    },
  ) {
    requiredFamilyActor(actor);
    const goal = await this.locked(actor, input.id, input.expectedVersion);
    domainGuard(() => canAddProgress(goal, input.amount));
    const now = input.now ?? new Date();
    const updated = await this.repository.updateGoal({
      familyId: actor.familyId,
      id: goal.id,
      expectedVersion: goal.version,
      patch: { progress: goal.progress + input.amount },
      updatedAt: now,
    });
    if (!updated) throw new GoalDomainError('STALE_VERSION', 'Goal updated elsewhere.');
    // Shared progress is family-level; no per-child percentages or leaderboard projection.
    const entry = {
      id: newId<'GoalProgressId'>(),
      familyId: actor.familyId,
      goalId: goal.id,
      contributedByChildId: actor.kind === 'CHILD' ? actor.childId : null,
      amount: input.amount,
      step: input.step.trim(),
      occurredAt: input.occurredAt,
      recordedAt: now,
    };
    await this.repository.insertProgress(entry);
    await this.appendEvent({
      familyId: actor.familyId,
      type: 'GoalProgressAdded',
      goalId: goal.id,
      occurredAt: input.occurredAt,
      recordedAt: now,
      payload: { amount: input.amount, progress: updated.progress },
    });
    return { goal: updated, entryId: entry.id };
  }

  async revise(
    actor: ActorContext,
    input: {
      id: string;
      target: number;
      targetDate: string | null;
      reason: string;
      nextStep?: string;
      expectedVersion?: number;
      occurredAt: Date;
      now?: Date;
    },
  ) {
    guardian(actor);
    const goal = await this.locked(actor, input.id, input.expectedVersion);
    domainGuard(() => canRevise(goal, input.target, input.targetDate));
    const now = input.now ?? new Date();
    await this.repository.insertRevision({
      id: newId<'GoalRevisionId'>(),
      familyId: actor.familyId,
      goalId: goal.id,
      previousTarget: goal.target,
      newTarget: input.target,
      previousTargetDate: goal.targetDate,
      newTargetDate: input.targetDate,
      reason: input.reason.trim(),
      revisedAt: now,
    });
    const updated = await this.repository.updateGoal({
      familyId: actor.familyId,
      id: goal.id,
      expectedVersion: goal.version,
      patch: {
        target: input.target,
        targetDate: input.targetDate,
        ...(input.nextStep ? { nextStep: input.nextStep.trim() } : {}),
      },
      updatedAt: now,
    });
    if (!updated) throw new GoalDomainError('STALE_VERSION', 'Goal changed.');
    await this.appendEvent({
      familyId: actor.familyId,
      type: 'GoalRevised',
      goalId: goal.id,
      occurredAt: input.occurredAt,
      recordedAt: now,
      payload: {
        previousTarget: goal.target,
        target: input.target,
        reason: input.reason,
      },
    });
    return updated;
  }

  async reflect(
    actor: ActorContext,
    input: { id: string; text: string; occurredAt: Date; now?: Date },
  ) {
    requiredFamilyActor(actor);
    const goal = await this.repository.getGoal(actor.familyId, input.id);
    if (!goal) {
      throw new GoalDomainError('RESOURCE_NOT_FOUND', 'Goal not found.');
    }
    authorizeRead(actor, goal);
    if (goal.status !== 'CLOSED' && goal.status !== 'ACHIEVED')
      throw new GoalDomainError(
        'RESOURCE_STATE_CHANGED',
        'Reflection follows goal achievement or closure.',
      );
    const now = input.now ?? new Date();
    const reflection = {
      id: newId<'GoalReflectionId'>(),
      familyId: actor.familyId,
      goalId: goal.id,
      authorChildId: actor.kind === 'CHILD' ? actor.childId : null,
      text: input.text.trim(),
      createdAt: now,
    };
    await this.repository.insertReflection(reflection);
    await this.appendEvent({
      familyId: actor.familyId,
      type: 'GoalReflectionRecorded',
      goalId: goal.id,
      occurredAt: input.occurredAt,
      recordedAt: now,
      payload: { authorKind: actor.kind },
    });
    return { id: reflection.id, goalId: goal.id };
  }

  async listVisible(actor: ActorContext, now = new Date()) {
    const family = await this.actorFamily(actor);
    const items =
      actor.kind === 'CHILD'
        ? await this.repository.listChildVisible(family.id, actor.childId)
        : await this.repository.listFamilyGoals(family.id);
    const today = localDateInTimezone(family.timezone, now);
    return items.map((goal) => ({
      id: goal.id,
      ownerType: goal.ownerType,
      ownerChildId: goal.ownerChildId,
      category: goal.category,
      title: goal.title,
      why: goal.why,
      nextStep: goal.nextStep,
      target: goal.target,
      progress: goal.progress,
      targetDate: goal.targetDate,
      status: displayGoalStatus(goal, today),
      version: goal.version,
    }));
  }
  async history(actor: ActorContext, id: string) {
    requiredFamilyActor(actor);
    const goal = await this.repository.getGoal(actor.familyId, id);
    if (!goal) throw new GoalDomainError('RESOURCE_NOT_FOUND', 'Goal not found.');
    authorizeRead(actor, goal);
    const [entries, revisions, reflections] = await Promise.all([
      this.repository.listProgress(actor.familyId, id),
      this.repository.listRevisions(actor.familyId, id),
      this.repository.listReflections(actor.familyId, id),
    ]);
    // Child shared-goal history omits contributor identities to avoid ranking/social comparison.
    return {
      goalId: id,
      entries: entries.map((e) => ({
        id: e.id,
        amount: e.amount,
        step: e.step,
        occurredAt: e.occurredAt.toISOString(),
      })),
      revisions: revisions.map((r) => ({
        id: r.id,
        previousTarget: r.previousTarget,
        newTarget: r.newTarget,
        previousTargetDate: r.previousTargetDate,
        newTargetDate: r.newTargetDate,
        reason: r.reason,
      })),
      reflections: reflections.map((r) => ({
        id: r.id,
        text: r.text,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
