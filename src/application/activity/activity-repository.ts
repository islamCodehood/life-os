import type {
  ActivityAssignment,
  ActivityDefinition,
  ActivityHistoryItem,
  ActivityInstance,
  ActivityInstanceContext,
  ActivityInstanceStatus,
  ActivityTemplate,
  ActivityTemplateKey,
  CompletionRecord,
  ReminderRecord,
} from '@/src/domain/activity/entities';
import type { ActivityOpportunityEvidence } from '@/src/domain/activity/progress';
import type {
  ActivityAssignmentId,
  ActivityInstanceId,
  ChildId,
  DomainEventId,
  FamilyId,
} from '@/src/domain/shared/id';

export interface SchedulingFamily {
  familyId: FamilyId;
  timezone: string;
}

export interface ActivityRepository {
  getTemplate(key: ActivityTemplateKey): Promise<ActivityTemplate | null>;

  findActiveAssignmentByTemplate(
    familyId: FamilyId,
    childId: ChildId,
    templateKey: ActivityTemplateKey,
  ): Promise<ActivityAssignment | null>;

  createDefinition(definition: ActivityDefinition): Promise<ActivityDefinition>;
  createAssignment(assignment: ActivityAssignment): Promise<ActivityAssignment>;

  listActiveAssignmentsForFamily(familyId: FamilyId): Promise<ActivityAssignment[]>;
  listSchedulingFamilies(): Promise<SchedulingFamily[]>;

  ensureInstance(instance: ActivityInstance): Promise<ActivityInstance>;

  listChildInstancesBetween(
    familyId: FamilyId,
    childId: ChildId,
    start: Date,
    end: Date,
  ): Promise<ActivityInstanceContext[]>;

  getInstanceForUpdate(
    familyId: FamilyId,
    instanceId: ActivityInstanceId,
  ): Promise<ActivityInstanceContext | null>;

  getCompletion(
    familyId: FamilyId,
    instanceId: ActivityInstanceId,
  ): Promise<CompletionRecord | null>;

  appendCompletion(record: CompletionRecord): Promise<void>;

  markInstanceCompleted(
    familyId: FamilyId,
    instanceId: ActivityInstanceId,
    expectedVersion: number,
    updatedAt: Date,
    allowedStatuses?: ActivityInstanceStatus[],
  ): Promise<ActivityInstance | null>;

  updateInstanceStatus(
    familyId: FamilyId,
    instanceId: ActivityInstanceId,
    expectedVersion: number,
    allowedStatuses: ActivityInstanceStatus[],
    status: ActivityInstanceStatus,
    updatedAt: Date,
  ): Promise<ActivityInstance | null>;

  markExpiredPendingAwaitingResolution(now: Date): Promise<number>;

  ensureReminder(record: ReminderRecord): Promise<ReminderRecord>;

  listRemindersForInstance(
    familyId: FamilyId,
    instanceId: ActivityInstanceId,
  ): Promise<ReminderRecord[]>;

  listProgressEvidence(
    familyId: FamilyId,
    assignmentId: ActivityAssignmentId,
    through: Date,
  ): Promise<ActivityOpportunityEvidence[]>;

  appendDomainEvent(input: {
    id: DomainEventId;
    familyId: FamilyId;
    type: string;
    aggregateType: string;
    aggregateId: string;
    occurredAt: Date;
    recordedAt: Date;
    payload: Record<string, unknown>;
  }): Promise<void>;

  listCompletionHistory(
    familyId: FamilyId,
    childId: ChildId,
    limit?: number,
  ): Promise<ActivityHistoryItem[]>;
}
