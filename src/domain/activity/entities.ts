import type {
  ActivityAssignmentId,
  ActivityDefinitionId,
  ActivityInstanceId,
  ChildId,
  CompletionRecordId,
  FamilyId,
  GuardianId,
  ReminderRecordId,
} from '@/src/domain/shared/id';

export type ActivityTemplateKey = 'SELF_MAKE_BED';

export type ActivityCategory =
  | 'SELF_RESPONSIBILITY'
  | 'FAMILY_RESPONSIBILITY'
  | 'GROWTH'
  | 'VALUES'
  | 'FAITH';

export type ActivityInstanceStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'AWAITING_RESOLUTION'
  | 'MISSED'
  | 'EXCUSED'
  | 'NOT_APPLICABLE';

export interface ActivityReminderPolicy {
  systemReminderOffsetMinutes: number | null;
}

export interface ActivityTemplate {
  key: ActivityTemplateKey;
  title: string;
  description: string | null;
  why: string | null;
  category: ActivityCategory;
  defaultScheduleRrule: 'FREQ=DAILY';
  defaultLocalTargetTime: string;
  defaultAvailableOffsetMinutes: number;
  defaultOpportunityEndOffsetMinutes: number;
  defaultTrackingMode: string;
  defaultCompletionMode: string;
  defaultApprovalMode: string;
  defaultProgressMode: string;
  defaultXpMode: string;
}

export interface ActivityDefinition {
  id: ActivityDefinitionId;
  familyId: FamilyId;
  templateKey: ActivityTemplateKey | null;
  title: string;
  description: string | null;
  why: string | null;
  category: ActivityCategory;
  createdByGuardianId: GuardianId;
  version: number;
  archivedAt: Date | null;
}

export interface ActivityAssignment {
  id: ActivityAssignmentId;
  familyId: FamilyId;
  childId: ChildId;
  activityDefinitionId: ActivityDefinitionId;
  status: 'ACTIVE' | 'ARCHIVED';
  scheduleRrule: 'FREQ=DAILY';
  scheduleTimezone: string;
  localTargetTime: string;
  availableOffsetMinutes: number;
  opportunityEndOffsetMinutes: number;
  trackingMode: string;
  completionMode: string;
  approvalMode: string;
  progressMode: string;
  xpMode: string;
  xpAmount: number | null;
  reminderPolicy: ActivityReminderPolicy;
  activeFrom: string;
  activeUntil: string | null;
  version: number;
  archivedAt: Date | null;
}

export interface ActivityInstance {
  id: ActivityInstanceId;
  familyId: FamilyId;
  childId: ChildId;
  assignmentId: ActivityAssignmentId;
  availableFrom: Date;
  targetAt: Date;
  opportunityEndsAt: Date;
  status: ActivityInstanceStatus;
  version: number;
}

export interface CompletionRecord {
  id: CompletionRecordId;
  familyId: FamilyId;
  activityInstanceId: ActivityInstanceId;
  occurredAt: Date;
  recordedAt: Date;
  reportedByKind: 'CHILD' | 'GUARDIAN';
  reportedById: string | null;
  selfInitiated: boolean;
  reminderCountAtCompletion: number;
  source: 'CHILD_SELF' | 'GUARDIAN';
}

export type ReminderSource = 'SYSTEM' | 'GUARDIAN' | 'CHILD';
export type ReminderKind = 'ACTIVITY';

export interface ReminderRecord {
  id: ReminderRecordId;
  familyId: FamilyId;
  activityInstanceId: ActivityInstanceId;
  source: ReminderSource;
  kind: ReminderKind;
  scheduledFor: Date;
  attemptedAt: Date | null;
  deliveredAt: Date | null;
  acknowledgedAt: Date | null;
}

export interface ActivityInstanceContext {
  instance: ActivityInstance;
  assignment: ActivityAssignment;
  definition: ActivityDefinition;
}

export interface ActivityHistoryItem {
  completion: CompletionRecord;
  title: string;
  templateKey: ActivityTemplateKey | null;
  targetAt: Date;
}
