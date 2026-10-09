import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ActivityProgressMetrics } from '@/src/domain/activity/progress';
import type { ObservationResult } from '@/src/domain/graduation/monitoring';
import type { ActivityAssignmentId, ChildId, FamilyId, GuardianId } from '@/src/domain/shared/id';
import * as s from '@/src/infrastructure/database/schema';
import type {
  GraduationAssignment, GraduationObservation, GraduationRecord, GraduationSuggestion,
  GraduationRepository,
} from '@/src/application/graduation/graduation-repository';

type Db = NodePgDatabase<typeof s>;
function assignment(row: typeof s.activityAssignments.$inferSelect): GraduationAssignment {
  if (row.status !== 'ACTIVE' && row.status !== 'GRADUATED') {
    throw new Error('Unsupported graduation assignment status.');
  }
  return {
    id: row.id as ActivityAssignmentId,
    familyId: row.familyId as FamilyId,
    childId: row.childId as ChildId,
    status: row.status,
    version: row.version,
    scheduleTimezone: row.scheduleTimezone,
    activeFrom: row.activeFrom,
  };
}
function suggestion(row: typeof s.graduationSuggestions.$inferSelect): GraduationSuggestion {
  return {
    id: row.id, familyId: row.familyId as FamilyId, childId: row.childId as ChildId,
    assignmentId: row.assignmentId as ActivityAssignmentId,
    graduationRecordId: row.graduationRecordId,
    kind: row.kind as GraduationSuggestion['kind'],
    origin: row.origin as GraduationSuggestion['origin'],
    status: row.status as GraduationSuggestion['status'],
    createdAt: row.createdAt,
  };
}
function record(row: typeof s.graduationRecords.$inferSelect): GraduationRecord {
  return {
    id: row.id, familyId: row.familyId as FamilyId, childId: row.childId as ChildId,
    assignmentId: row.assignmentId as ActivityAssignmentId,
    status: row.status as GraduationRecord['status'],
    approvedAt: row.approvedAt,
    monitoringIntervalDays: row.monitoringIntervalDays,
    lastObservedAt: row.lastObservedAt,
  };
}
function observation(row: typeof s.graduationObservations.$inferSelect): GraduationObservation {
  return { id: row.id, result: row.result as ObservationResult, observedAt: row.observedAt };
}

export class PostgresGraduationRepository implements GraduationRepository {
  constructor(private readonly db: Db) {}

  async getAssignment(familyId: FamilyId, assignmentId: ActivityAssignmentId) {
    const [row] = await this.db.select().from(s.activityAssignments).where(and(
      eq(s.activityAssignments.familyId, familyId),
      eq(s.activityAssignments.id, assignmentId),
      isNull(s.activityAssignments.archivedAt),
    )).limit(1);
    return row && (row.status === 'ACTIVE' || row.status === 'GRADUATED')
      ? assignment(row) : null;
  }

  async getMakeBedAssignment(familyId: FamilyId, childId: ChildId) {
    const [row] = await this.db.select({ item: s.activityAssignments })
      .from(s.activityAssignments)
      .innerJoin(s.activityDefinitions, and(
        eq(s.activityDefinitions.id, s.activityAssignments.activityDefinitionId),
        eq(s.activityDefinitions.familyId, s.activityAssignments.familyId),
      ))
      .where(and(
        eq(s.activityAssignments.familyId, familyId),
        eq(s.activityAssignments.childId, childId),
        sql`${s.activityAssignments.status} IN ('ACTIVE', 'GRADUATED')`,
        isNull(s.activityAssignments.archivedAt),
        eq(s.activityDefinitions.templateKey, 'SELF_MAKE_BED'),
        isNull(s.activityDefinitions.archivedAt),
      )).limit(1);
    return row ? assignment(row.item) : null;
  }

  async getSuggestion(familyId: FamilyId, id: string) {
    const [row] = await this.db.select().from(s.graduationSuggestions).where(and(
      eq(s.graduationSuggestions.familyId, familyId), eq(s.graduationSuggestions.id, id),
    )).limit(1);
    return row ? suggestion(row) : null;
  }

  async getPendingSuggestion(familyId: FamilyId, assignmentId: ActivityAssignmentId, kind: 'GRADUATION' | 'REACTIVATION') {
    const [row] = await this.db.select().from(s.graduationSuggestions).where(and(
      eq(s.graduationSuggestions.familyId, familyId),
      eq(s.graduationSuggestions.assignmentId, assignmentId),
      eq(s.graduationSuggestions.kind, kind),
      eq(s.graduationSuggestions.status, 'PENDING'),
    )).limit(1);
    return row ? suggestion(row) : null;
  }

  async createEvidenceSnapshot(input: {
    id: string; familyId: FamilyId; assignmentId: ActivityAssignmentId;
    metrics: ActivityProgressMetrics; capturedAt: Date;
  }) {
    await this.db.insert(s.graduationEvidenceSnapshots).values(input);
  }

  async createSuggestion(input: {
    id: string; familyId: FamilyId; childId: ChildId; assignmentId: ActivityAssignmentId;
    kind: 'GRADUATION' | 'REACTIVATION'; origin: 'GUARDIAN_REVIEW' | 'MONITORING_EVIDENCE';
    evidenceSnapshotId?: string; graduationRecordId?: string; createdAt: Date;
  }) {
    await this.db.insert(s.graduationSuggestions).values({
      ...input, status: 'PENDING',
    }).onConflictDoNothing();
    const pending = await this.getPendingSuggestion(input.familyId, input.assignmentId, input.kind);
    if (!pending) throw new Error('Cannot create graduation review.');
    return pending;
  }

  async decideSuggestion(
    familyId: FamilyId, id: string, status: 'ACCEPTED' | 'DECLINED' | 'SNOOZED',
    guardianId: GuardianId, now: Date,
  ) {
    const [row] = await this.db.update(s.graduationSuggestions).set({
      status, decidedAt: now, decidedBy: guardianId,
    }).where(and(
      eq(s.graduationSuggestions.familyId, familyId),
      eq(s.graduationSuggestions.id, id),
      eq(s.graduationSuggestions.status, 'PENDING'),
    )).returning();
    return row ? suggestion(row) : null;
  }

  async transitionAssignment(input: {
    familyId: FamilyId; assignmentId: ActivityAssignmentId; expectedVersion: number;
    from: 'ACTIVE' | 'GRADUATED'; to: 'ACTIVE' | 'GRADUATED';
    now: Date; activeFrom?: string;
  }) {
    const [row] = await this.db.update(s.activityAssignments).set({
      status: input.to, version: sql`${s.activityAssignments.version} + 1`,
      updatedAt: input.now, ...(input.activeFrom ? { activeFrom: input.activeFrom } : {}),
    }).where(and(
      eq(s.activityAssignments.familyId, input.familyId),
      eq(s.activityAssignments.id, input.assignmentId),
      eq(s.activityAssignments.status, input.from),
      eq(s.activityAssignments.version, input.expectedVersion),
      isNull(s.activityAssignments.archivedAt),
    )).returning();
    return row ? assignment(row) : null;
  }

  async createGraduationRecord(input: {
    id: string; familyId: FamilyId; childId: ChildId; assignmentId: ActivityAssignmentId;
    approvedBy: GuardianId; approvedAt: Date; monitoringIntervalDays: number;
  }) {
    const [row] = await this.db.insert(s.graduationRecords).values({
      ...input, status: 'GRADUATED',
    }).returning();
    if (!row) throw new Error('Graduation record was not persisted.');
    return record(row);
  }

  async getActiveGraduation(familyId: FamilyId, assignmentId: ActivityAssignmentId) {
    const [row] = await this.db.select().from(s.graduationRecords).where(and(
      eq(s.graduationRecords.familyId, familyId),
      eq(s.graduationRecords.assignmentId, assignmentId),
      eq(s.graduationRecords.status, 'GRADUATED'),
    )).limit(1);
    return row ? record(row) : null;
  }

  async listChildGraduated(familyId: FamilyId, childId: ChildId) {
    const rows = await this.db.select({
      graduation: s.graduationRecords, title: s.activityDefinitions.title,
      templateKey: s.activityDefinitions.templateKey,
    }).from(s.graduationRecords)
      .innerJoin(s.activityAssignments, and(
        eq(s.activityAssignments.id, s.graduationRecords.assignmentId),
        eq(s.activityAssignments.familyId, s.graduationRecords.familyId),
        eq(s.activityAssignments.status, 'GRADUATED'),
      ))
      .innerJoin(s.activityDefinitions, and(
        eq(s.activityDefinitions.id, s.activityAssignments.activityDefinitionId),
        eq(s.activityDefinitions.familyId, s.activityAssignments.familyId),
      ))
      .where(and(
        eq(s.graduationRecords.familyId, familyId),
        eq(s.graduationRecords.childId, childId),
        eq(s.graduationRecords.status, 'GRADUATED'),
      ));
    return rows.map((row) => ({
      record: record(row.graduation), title: row.title, templateKey: row.templateKey,
    }));
  }

  async addObservation(input: {
    id: string; familyId: FamilyId; graduationRecordId: string;
    recordedBy: GuardianId; result: ObservationResult; observedAt: Date; recordedAt: Date;
  }) {
    await this.db.insert(s.graduationObservations).values(input);
    await this.db.update(s.graduationRecords)
      .set({ lastObservedAt: sql`GREATEST(COALESCE(${s.graduationRecords.lastObservedAt}, ${input.observedAt}), ${input.observedAt})` })
      .where(and(
        eq(s.graduationRecords.familyId, input.familyId),
        eq(s.graduationRecords.id, input.graduationRecordId),
        eq(s.graduationRecords.status, 'GRADUATED'),
      ));
  }

  async listObservations(familyId: FamilyId, graduationRecordId: string) {
    const rows = await this.db.select().from(s.graduationObservations).where(and(
      eq(s.graduationObservations.familyId, familyId),
      eq(s.graduationObservations.graduationRecordId, graduationRecordId),
    )).orderBy(desc(s.graduationObservations.observedAt));
    return rows.map(observation);
  }

  async reactivateRecord(familyId: FamilyId, recordId: string, guardianId: GuardianId, now: Date) {
    const [row] = await this.db.update(s.graduationRecords).set({
      status: 'REACTIVATED', reactivatedAt: now, reactivatedBy: guardianId,
    }).where(and(
      eq(s.graduationRecords.familyId, familyId),
      eq(s.graduationRecords.id, recordId),
      eq(s.graduationRecords.status, 'GRADUATED'),
    )).returning();
    return row ? record(row) : null;
  }
}
