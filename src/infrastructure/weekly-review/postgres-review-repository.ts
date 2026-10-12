import { and, eq, lt, sql, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ReviewRepository } from '@/src/application/weekly-review/review-repository';
import type {
  WeeklyReview,
  ReviewEntry,
  ReviewStatus,
  ReviewPrompt,
  WeeklySummary,
} from '@/src/domain/weekly-review/review';
import * as s from '@/src/infrastructure/database/schema';
type Db = NodePgDatabase<typeof s>;
function asReview(row: typeof s.weeklyReviews.$inferSelect): WeeklyReview {
  return { ...row, status: row.status as ReviewStatus };
}
function asEntry(row: typeof s.weeklyReviewEntries.$inferSelect): ReviewEntry {
  return {
    ...row,
    authorKind: row.authorKind as ReviewEntry['authorKind'],
    prompt: row.prompt as ReviewPrompt,
  };
}
export class PostgresReviewRepository implements ReviewRepository {
  constructor(private readonly db: Db) {}
  async create(review: WeeklyReview) {
    const [created] = await this.db
      .insert(s.weeklyReviews)
      .values(review)
      .onConflictDoNothing({ target: [s.weeklyReviews.familyId, s.weeklyReviews.weekStart] })
      .returning();
    if (created) return asReview(created);
    const existing = await this.forWeek(review.familyId, review.weekStart);
    if (!existing) throw new Error('Concurrent review creation did not return a record.');
    return existing;
  }
  async get(familyId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(s.weeklyReviews)
      .where(and(eq(s.weeklyReviews.familyId, familyId), eq(s.weeklyReviews.id, id)))
      .limit(1);
    return row ? asReview(row) : null;
  }
  async lock(familyId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(s.weeklyReviews)
      .where(and(eq(s.weeklyReviews.familyId, familyId), eq(s.weeklyReviews.id, id)))
      .for('update')
      .limit(1);
    return row ? asReview(row) : null;
  }
  async forWeek(familyId: string, weekStart: string) {
    const [row] = await this.db
      .select()
      .from(s.weeklyReviews)
      .where(and(eq(s.weeklyReviews.familyId, familyId), eq(s.weeklyReviews.weekStart, weekStart)))
      .limit(1);
    return row ? asReview(row) : null;
  }
  async entries(familyId: string, id: string) {
    const rows = await this.db
      .select()
      .from(s.weeklyReviewEntries)
      .where(
        and(eq(s.weeklyReviewEntries.familyId, familyId), eq(s.weeklyReviewEntries.reviewId, id)),
      )
      .orderBy(s.weeklyReviewEntries.authorKey, s.weeklyReviewEntries.prompt);
    return rows.map(asEntry);
  }
  async entry(familyId: string, reviewId: string, authorKey: string, prompt: ReviewPrompt) {
    const [row] = await this.db
      .select()
      .from(s.weeklyReviewEntries)
      .where(
        and(
          eq(s.weeklyReviewEntries.familyId, familyId),
          eq(s.weeklyReviewEntries.reviewId, reviewId),
          eq(s.weeklyReviewEntries.authorKey, authorKey),
          eq(s.weeklyReviewEntries.prompt, prompt),
        ),
      )
      .limit(1);
    return row ? asEntry(row) : null;
  }
  async insertEntry(entry: ReviewEntry) {
    const [row] = await this.db
      .insert(s.weeklyReviewEntries)
      .values(entry)
      .onConflictDoNothing({
        target: [
          s.weeklyReviewEntries.reviewId,
          s.weeklyReviewEntries.authorKey,
          s.weeklyReviewEntries.prompt,
        ],
      })
      .returning({ id: s.weeklyReviewEntries.id });
    return !!row;
  }
  async updateEntry(entry: ReviewEntry, expectedVersion: number) {
    const [row] = await this.db
      .update(s.weeklyReviewEntries)
      .set({
        text: entry.text,
        updatedAt: entry.updatedAt,
        version: sql`${s.weeklyReviewEntries.version}+1`,
      })
      .where(
        and(
          eq(s.weeklyReviewEntries.familyId, entry.familyId),
          eq(s.weeklyReviewEntries.reviewId, entry.reviewId),
          eq(s.weeklyReviewEntries.authorKey, entry.authorKey),
          eq(s.weeklyReviewEntries.prompt, entry.prompt),
          eq(s.weeklyReviewEntries.version, expectedVersion),
        ),
      )
      .returning({ id: s.weeklyReviewEntries.id });
    return !!row;
  }
  async transition(
    familyId: string,
    id: string,
    expectedVersion: number,
    status: ReviewStatus,
    focus: string | null,
    now: Date,
  ) {
    const [row] = await this.db
      .update(s.weeklyReviews)
      .set({
        status,
        nextFocus: focus,
        finishedAt: now,
        version: sql`${s.weeklyReviews.version}+1`,
      })
      .where(
        and(
          eq(s.weeklyReviews.familyId, familyId),
          eq(s.weeklyReviews.id, id),
          eq(s.weeklyReviews.status, 'OPEN'),
          eq(s.weeklyReviews.version, expectedVersion),
        ),
      )
      .returning();
    return row ? asReview(row) : null;
  }
  async abandonOlder(familyId: string, beforeWeekStart: string, now: Date) {
    const rows = await this.db
      .update(s.weeklyReviews)
      .set({
        status: 'ABANDONED',
        finishedAt: now,
        version: sql`${s.weeklyReviews.version}+1`,
      })
      .where(
        and(
          eq(s.weeklyReviews.familyId, familyId),
          lt(s.weeklyReviews.weekStart, beforeWeekStart),
          eq(s.weeklyReviews.status, 'OPEN'),
        ),
      )
      .returning({ id: s.weeklyReviews.id });
    return rows.length;
  }
  async listFamilies() {
    return this.db
      .select({
        id: s.families.id,
        timezone: s.families.timezone,
        weeklyReviewDay: s.families.weeklyReviewDay,
      })
      .from(s.families);
  }
  async summary(
    familyId: string,
    weekStart: string,
    weekEnd: string,
    childId: string | null,
  ): Promise<WeeklySummary> {
    const start = sql`${weekStart}::date`,
      end = sql`${weekEnd}::date`;
    // SQL compares LOCAL calendar days in the family's IANA time zone, never server-UTC dates.
    const [family] = await this.db
      .select({ timezone: s.families.timezone })
      .from(s.families)
      .where(eq(s.families.id, familyId))
      .limit(1);
    if (!family) throw new Error('Family no longer exists.');
    const local = (column: unknown) => sql`(${column} AT TIME ZONE ${family.timezone})::date`;
    const period = (column: unknown) =>
      and(sql`${local(column)}>=${start}`, sql`${local(column)}<${end}`);
    const completions = await this.db
      .select({ category: s.activityDefinitions.category, count: sql<number>`count(*)::int` })
      .from(s.completionRecords)
      .innerJoin(
        s.activityInstances,
        and(
          eq(s.completionRecords.activityInstanceId, s.activityInstances.id),
          eq(s.completionRecords.familyId, s.activityInstances.familyId),
        ),
      )
      .innerJoin(
        s.activityAssignments,
        and(
          eq(s.activityInstances.assignmentId, s.activityAssignments.id),
          eq(s.activityInstances.familyId, s.activityAssignments.familyId),
        ),
      )
      .innerJoin(
        s.activityDefinitions,
        and(
          eq(s.activityAssignments.activityDefinitionId, s.activityDefinitions.id),
          eq(s.activityAssignments.familyId, s.activityDefinitions.familyId),
        ),
      )
      .where(
        and(
          eq(s.completionRecords.familyId, familyId),
          period(s.completionRecords.occurredAt),
          ...(childId ? [eq(s.activityInstances.childId, childId)] : []),
        ),
      )
      .groupBy(s.activityDefinitions.category);
    const goals = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.domainEvents)
      .innerJoin(
        s.goals,
        and(
          eq(s.domainEvents.aggregateId, s.goals.id),
          eq(s.domainEvents.familyId, s.goals.familyId),
        ),
      )
      .where(
        and(
          eq(s.domainEvents.familyId, familyId),
          eq(s.domainEvents.type, 'GoalStatusChanged'),
          sql`${s.domainEvents.payload}->>'to'='ACHIEVED'`,
          period(s.domainEvents.occurredAt),
          ...(childId ? [eq(s.goals.ownerType, 'CHILD'), eq(s.goals.ownerChildId, childId)] : []),
        ),
      );
    const moments = await this.db
      .select({ privacy: s.moments.privacy, count: sql<number>`count(*)::int` })
      .from(s.moments)
      .where(
        and(
          eq(s.moments.familyId, familyId),
          eq(s.moments.status, 'PUBLISHED'),
          period(s.moments.occurredAt),
          ...(childId
            ? [
                sql`(${s.moments.privacy}='FAMILY_SHARED' OR
        (${s.moments.privacy}='CHILD_SAFE' AND ${s.moments.subjectChildId}=${childId}::uuid))`,
              ]
            : []),
        ),
      )
      .groupBy(s.moments.privacy);
    return {
      window: { weekStart, weekEnd },
      completedResponsibilities: completions
        .filter(
          (c) => c.category === 'SELF_RESPONSIBILITY' || c.category === 'FAMILY_RESPONSIBILITY',
        )
        .reduce((sum, c) => sum + c.count, 0),
      practisedSkills: completions
        .filter((c) => c.category === 'GROWTH')
        .reduce((sum, c) => sum + c.count, 0),
      achievedGoals: goals[0]?.count ?? 0,
      sharedMoments: moments.find((c) => c.privacy === 'FAMILY_SHARED')?.count ?? 0,
      personalMoments: moments
        .filter((c) => c.privacy === 'CHILD_SAFE')
        .reduce((sum, c) => sum + c.count, 0),
    };
  }
}
