import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ActivityRepository } from '@/src/application/activity/activity-repository';
import type {
  ActivityAssignment,
  ActivityCategory,
  ActivityDefinition,
  ActivityHistoryItem,
  ActivityInstance,
  ActivityInstanceStatus,
  ActivityTemplate,
  ActivityTemplateKey,
  CompletionRecord,
} from '@/src/domain/activity/entities';
import type {
  ActivityAssignmentId,
  ActivityDefinitionId,
  ActivityInstanceId,
  ChildId,
  CompletionRecordId,
  FamilyId,
  GuardianId,
} from '@/src/domain/shared/id';
import * as schema from '@/src/infrastructure/database/schema';

type Db = NodePgDatabase<typeof schema>;

function category(value: string): ActivityCategory {
  if (
    value === 'SELF_RESPONSIBILITY' ||
    value === 'FAMILY_RESPONSIBILITY' ||
    value === 'GROWTH' ||
    value === 'VALUES' ||
    value === 'FAITH'
  ) {
    return value;
  }
  throw new Error(`Unsupported activity category: ${value}`);
}

function templateKey(value: string | null): ActivityTemplateKey | null {
  if (value === null) return null;
  if (value === 'SELF_MAKE_BED') return value;
  throw new Error(`Unsupported activity template: ${value}`);
}

function instanceStatus(value: string): ActivityInstanceStatus {
  if (
    value === 'PENDING' ||
    value === 'COMPLETED' ||
    value === 'AWAITING_RESOLUTION' ||
    value === 'MISSED' ||
    value === 'EXCUSED' ||
    value === 'NOT_APPLICABLE'
  ) {
    return value;
  }
  throw new Error(`Unsupported activity instance status: ${value}`);
}

function reminderPolicy(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function templateRow(row: typeof schema.activityTemplates.$inferSelect): ActivityTemplate {
  if (row.defaultScheduleRrule !== 'FREQ=DAILY') {
    throw new Error(`Unsupported E2 schedule: ${row.defaultScheduleRrule}`);
  }
  return {
    key: templateKey(row.key) ?? 'SELF_MAKE_BED',
    title: row.title,
    description: row.description,
    why: row.why,
    category: category(row.category),
    defaultScheduleRrule: 'FREQ=DAILY',
    defaultLocalTargetTime: row.defaultLocalTargetTime,
    defaultAvailableOffsetMinutes: row.defaultAvailableOffsetMinutes,
    defaultOpportunityEndOffsetMinutes: row.defaultOpportunityEndOffsetMinutes,
    defaultTrackingMode: row.defaultTrackingMode,
    defaultCompletionMode: row.defaultCompletionMode,
    defaultApprovalMode: row.defaultApprovalMode,
    defaultProgressMode: row.defaultProgressMode,
    defaultXpMode: row.defaultXpMode,
  };
}

function definitionRow(row: typeof schema.activityDefinitions.$inferSelect): ActivityDefinition {
  return {
    id: row.id as ActivityDefinitionId,
    familyId: row.familyId as FamilyId,
    templateKey: templateKey(row.templateKey),
    title: row.title,
    description: row.description,
    why: row.why,
    category: category(row.category),
    createdByGuardianId: row.createdByGuardianId as GuardianId,
    version: row.version,
    archivedAt: row.archivedAt,
  };
}

function assignmentRow(row: typeof schema.activityAssignments.$inferSelect): ActivityAssignment {
  if (row.scheduleRrule !== 'FREQ=DAILY') {
    throw new Error(`Unsupported E2 schedule: ${row.scheduleRrule}`);
  }
  return {
    id: row.id as ActivityAssignmentId,
    familyId: row.familyId as FamilyId,
    childId: row.childId as ChildId,
    activityDefinitionId: row.activityDefinitionId as ActivityDefinitionId,
    status: row.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    scheduleRrule: 'FREQ=DAILY',
    scheduleTimezone: row.scheduleTimezone,
    localTargetTime: row.localTargetTime,
    availableOffsetMinutes: row.availableOffsetMinutes,
    opportunityEndOffsetMinutes: row.opportunityEndOffsetMinutes,
    trackingMode: row.trackingMode,
    completionMode: row.completionMode,
    approvalMode: row.approvalMode,
    progressMode: row.progressMode,
    xpMode: row.xpMode,
    xpAmount: row.xpAmount,
    reminderPolicy: reminderPolicy(row.reminderPolicy),
    activeFrom: row.activeFrom,
    activeUntil: row.activeUntil,
    version: row.version,
    archivedAt: row.archivedAt,
  };
}

function instanceRow(row: typeof schema.activityInstances.$inferSelect): ActivityInstance {
  return {
    id: row.id as ActivityInstanceId,
    familyId: row.familyId as FamilyId,
    childId: row.childId as ChildId,
    assignmentId: row.assignmentId as ActivityAssignmentId,
    availableFrom: row.availableFrom,
    targetAt: row.targetAt,
    opportunityEndsAt: row.opportunityEndsAt,
    status: instanceStatus(row.status),
    version: row.version,
  };
}

function completionRow(row: typeof schema.completionRecords.$inferSelect): CompletionRecord {
  return {
    id: row.id as CompletionRecordId,
    familyId: row.familyId as FamilyId,
    activityInstanceId: row.activityInstanceId as ActivityInstanceId,
    occurredAt: row.occurredAt,
    recordedAt: row.recordedAt,
    reportedByKind: row.reportedByKind === 'GUARDIAN' ? 'GUARDIAN' : 'CHILD',
    reportedById: row.reportedById,
    selfInitiated: row.selfInitiated,
    reminderCountAtCompletion: row.reminderCountAtCompletion,
    source: row.source === 'GUARDIAN' ? 'GUARDIAN' : 'CHILD_SELF',
  };
}

export class PostgresActivityRepository implements ActivityRepository {
  constructor(private readonly db: Db) {}

  async getTemplate(key: ActivityTemplateKey) {
    const [row] = await this.db
      .select()
      .from(schema.activityTemplates)
      .where(eq(schema.activityTemplates.key, key))
      .limit(1);
    return row ? templateRow(row) : null;
  }

  async findActiveAssignmentByTemplate(
    familyId: FamilyId,
    childId: ChildId,
    key: ActivityTemplateKey,
  ) {
    const [row] = await this.db
      .select({ assignment: schema.activityAssignments })
      .from(schema.activityAssignments)
      .innerJoin(
        schema.activityDefinitions,
        and(
          eq(schema.activityDefinitions.id, schema.activityAssignments.activityDefinitionId),
          eq(schema.activityDefinitions.familyId, schema.activityAssignments.familyId),
        ),
      )
      .where(
        and(
          eq(schema.activityAssignments.familyId, familyId),
          eq(schema.activityAssignments.childId, childId),
          eq(schema.activityAssignments.status, 'ACTIVE'),
          isNull(schema.activityAssignments.archivedAt),
          eq(schema.activityDefinitions.templateKey, key),
          isNull(schema.activityDefinitions.archivedAt),
        ),
      )
      .limit(1);

    return row ? assignmentRow(row.assignment) : null;
  }

  async createDefinition(definition: ActivityDefinition) {
    const [row] = await this.db
      .insert(schema.activityDefinitions)
      .values({
        id: definition.id,
        familyId: definition.familyId,
        templateKey: definition.templateKey,
        title: definition.title,
        description: definition.description,
        why: definition.why,
        category: definition.category,
        createdByGuardianId: definition.createdByGuardianId,
        version: definition.version,
        archivedAt: definition.archivedAt,
      })
      .returning();
    if (!row) throw new Error('Failed to create activity definition.');
    return definitionRow(row);
  }

  async createAssignment(assignment: ActivityAssignment) {
    const [row] = await this.db
      .insert(schema.activityAssignments)
      .values({
        id: assignment.id,
        familyId: assignment.familyId,
        childId: assignment.childId,
        activityDefinitionId: assignment.activityDefinitionId,
        status: assignment.status,
        scheduleRrule: assignment.scheduleRrule,
        scheduleTimezone: assignment.scheduleTimezone,
        localTargetTime: assignment.localTargetTime,
        availableOffsetMinutes: assignment.availableOffsetMinutes,
        opportunityEndOffsetMinutes: assignment.opportunityEndOffsetMinutes,
        trackingMode: assignment.trackingMode,
        completionMode: assignment.completionMode,
        approvalMode: assignment.approvalMode,
        progressMode: assignment.progressMode,
        xpMode: assignment.xpMode,
        xpAmount: assignment.xpAmount,
        reminderPolicy: assignment.reminderPolicy,
        activeFrom: assignment.activeFrom,
        activeUntil: assignment.activeUntil,
        version: assignment.version,
        archivedAt: assignment.archivedAt,
      })
      .returning();
    if (!row) throw new Error('Failed to create activity assignment.');
    return assignmentRow(row);
  }

  async listActiveAssignmentsForFamily(familyId: FamilyId) {
    const rows = await this.db
      .select()
      .from(schema.activityAssignments)
      .where(
        and(
          eq(schema.activityAssignments.familyId, familyId),
          eq(schema.activityAssignments.status, 'ACTIVE'),
          isNull(schema.activityAssignments.archivedAt),
        ),
      );
    return rows.map(assignmentRow);
  }

  async listSchedulingFamilies() {
    const rows = await this.db
      .selectDistinct({
        familyId: schema.activityAssignments.familyId,
        timezone: schema.activityAssignments.scheduleTimezone,
      })
      .from(schema.activityAssignments)
      .where(
        and(
          eq(schema.activityAssignments.status, 'ACTIVE'),
          isNull(schema.activityAssignments.archivedAt),
        ),
      );
    return rows.map((row) => ({
      familyId: row.familyId as FamilyId,
      timezone: row.timezone,
    }));
  }

  async ensureInstance(instance: ActivityInstance) {
    const [inserted] = await this.db
      .insert(schema.activityInstances)
      .values({
        id: instance.id,
        familyId: instance.familyId,
        childId: instance.childId,
        assignmentId: instance.assignmentId,
        availableFrom: instance.availableFrom,
        targetAt: instance.targetAt,
        opportunityEndsAt: instance.opportunityEndsAt,
        status: instance.status,
        version: instance.version,
      })
      .onConflictDoNothing({
        target: [schema.activityInstances.assignmentId, schema.activityInstances.targetAt],
      })
      .returning();

    if (inserted) return instanceRow(inserted);

    const [existing] = await this.db
      .select()
      .from(schema.activityInstances)
      .where(
        and(
          eq(schema.activityInstances.assignmentId, instance.assignmentId),
          eq(schema.activityInstances.targetAt, instance.targetAt),
        ),
      )
      .limit(1);

    if (!existing) throw new Error('Activity instance conflict could not be resolved.');
    return instanceRow(existing);
  }

  async listChildInstancesBetween(familyId: FamilyId, childId: ChildId, start: Date, end: Date) {
    const rows = await this.db
      .select({
        instance: schema.activityInstances,
        assignment: schema.activityAssignments,
        definition: schema.activityDefinitions,
      })
      .from(schema.activityInstances)
      .innerJoin(
        schema.activityAssignments,
        and(
          eq(schema.activityAssignments.id, schema.activityInstances.assignmentId),
          eq(schema.activityAssignments.familyId, schema.activityInstances.familyId),
        ),
      )
      .innerJoin(
        schema.activityDefinitions,
        and(
          eq(schema.activityDefinitions.id, schema.activityAssignments.activityDefinitionId),
          eq(schema.activityDefinitions.familyId, schema.activityAssignments.familyId),
        ),
      )
      .where(
        and(
          eq(schema.activityInstances.familyId, familyId),
          eq(schema.activityInstances.childId, childId),
          gte(schema.activityInstances.targetAt, start),
          lt(schema.activityInstances.targetAt, end),
        ),
      );

    return rows.map((row) => ({
      instance: instanceRow(row.instance),
      assignment: assignmentRow(row.assignment),
      definition: definitionRow(row.definition),
    }));
  }

  async getInstanceForUpdate(familyId: FamilyId, instanceId: ActivityInstanceId) {
    const [row] = await this.db
      .select({
        instance: schema.activityInstances,
        assignment: schema.activityAssignments,
        definition: schema.activityDefinitions,
      })
      .from(schema.activityInstances)
      .innerJoin(
        schema.activityAssignments,
        and(
          eq(schema.activityAssignments.id, schema.activityInstances.assignmentId),
          eq(schema.activityAssignments.familyId, schema.activityInstances.familyId),
        ),
      )
      .innerJoin(
        schema.activityDefinitions,
        and(
          eq(schema.activityDefinitions.id, schema.activityAssignments.activityDefinitionId),
          eq(schema.activityDefinitions.familyId, schema.activityAssignments.familyId),
        ),
      )
      .where(
        and(
          eq(schema.activityInstances.familyId, familyId),
          eq(schema.activityInstances.id, instanceId),
        ),
      )
      .for('update')
      .limit(1);

    return row
      ? {
          instance: instanceRow(row.instance),
          assignment: assignmentRow(row.assignment),
          definition: definitionRow(row.definition),
        }
      : null;
  }

  async getCompletion(familyId: FamilyId, instanceId: ActivityInstanceId) {
    const [row] = await this.db
      .select()
      .from(schema.completionRecords)
      .where(
        and(
          eq(schema.completionRecords.familyId, familyId),
          eq(schema.completionRecords.activityInstanceId, instanceId),
        ),
      )
      .limit(1);
    return row ? completionRow(row) : null;
  }

  async appendCompletion(record: CompletionRecord) {
    await this.db.insert(schema.completionRecords).values({
      id: record.id,
      familyId: record.familyId,
      activityInstanceId: record.activityInstanceId,
      occurredAt: record.occurredAt,
      recordedAt: record.recordedAt,
      reportedByKind: record.reportedByKind,
      reportedById: record.reportedById,
      selfInitiated: record.selfInitiated,
      reminderCountAtCompletion: record.reminderCountAtCompletion,
      source: record.source,
    });
  }

  async markInstanceCompleted(
    familyId: FamilyId,
    instanceId: ActivityInstanceId,
    expectedVersion: number,
    updatedAt: Date,
  ) {
    const [row] = await this.db
      .update(schema.activityInstances)
      .set({
        status: 'COMPLETED',
        updatedAt,
        version: sql`${schema.activityInstances.version} + 1`,
      })
      .where(
        and(
          eq(schema.activityInstances.familyId, familyId),
          eq(schema.activityInstances.id, instanceId),
          eq(schema.activityInstances.version, expectedVersion),
          eq(schema.activityInstances.status, 'PENDING'),
        ),
      )
      .returning();

    return row ? instanceRow(row) : null;
  }

  async appendDomainEvent(input: {
    id: import('@/src/domain/shared/id').DomainEventId;
    familyId: FamilyId;
    type: string;
    aggregateType: string;
    aggregateId: string;
    occurredAt: Date;
    recordedAt: Date;
    payload: Record<string, unknown>;
  }) {
    await this.db.insert(schema.domainEvents).values({
      id: input.id,
      familyId: input.familyId,
      type: input.type,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      occurredAt: input.occurredAt,
      recordedAt: input.recordedAt,
      payload: input.payload,
    });
  }

  async listCompletionHistory(
    familyId: FamilyId,
    childId: ChildId,
    limit = 10,
  ): Promise<ActivityHistoryItem[]> {
    const rows = await this.db
      .select({
        completion: schema.completionRecords,
        instance: schema.activityInstances,
        definition: schema.activityDefinitions,
      })
      .from(schema.completionRecords)
      .innerJoin(
        schema.activityInstances,
        and(
          eq(schema.activityInstances.id, schema.completionRecords.activityInstanceId),
          eq(schema.activityInstances.familyId, schema.completionRecords.familyId),
        ),
      )
      .innerJoin(
        schema.activityAssignments,
        and(
          eq(schema.activityAssignments.id, schema.activityInstances.assignmentId),
          eq(schema.activityAssignments.familyId, schema.activityInstances.familyId),
        ),
      )
      .innerJoin(
        schema.activityDefinitions,
        and(
          eq(schema.activityDefinitions.id, schema.activityAssignments.activityDefinitionId),
          eq(schema.activityDefinitions.familyId, schema.activityAssignments.familyId),
        ),
      )
      .where(
        and(
          eq(schema.completionRecords.familyId, familyId),
          eq(schema.activityInstances.childId, childId),
        ),
      )
      .orderBy(desc(schema.completionRecords.recordedAt))
      .limit(limit);

    return rows.map((row) => ({
      completion: completionRow(row.completion),
      title: row.definition.title,
      templateKey: templateKey(row.definition.templateKey),
      targetAt: row.instance.targetAt,
    }));
  }
}
