import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { lifeOsSchema } from '../schema-root';
import { childProfiles, families, familyGuardians } from './identity';

export const activityTemplates = lifeOsSchema.table('activity_templates', {
  key: text('key').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  why: text('why'),
  category: text('category').notNull(),
  defaultScheduleRrule: text('default_schedule_rrule').notNull(),
  defaultLocalTargetTime: text('default_local_target_time').notNull(),
  defaultAvailableOffsetMinutes: integer('default_available_offset_minutes').notNull(),
  defaultOpportunityEndOffsetMinutes: integer('default_opportunity_end_offset_minutes').notNull(),
  defaultTrackingMode: text('default_tracking_mode').notNull(),
  defaultCompletionMode: text('default_completion_mode').notNull(),
  defaultApprovalMode: text('default_approval_mode').notNull(),
  defaultProgressMode: text('default_progress_mode').notNull(),
  defaultXpMode: text('default_xp_mode').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activityDefinitions = lifeOsSchema.table(
  'activity_definitions',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    templateKey: text('template_key').references(() => activityTemplates.key),
    title: text('title').notNull(),
    description: text('description'),
    why: text('why'),
    category: text('category').notNull(),
    createdByGuardianId: uuid('created_by_guardian_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('activity_definitions_family_pair_uidx').on(table.id, table.familyId),
    index('activity_definitions_family_idx').on(table.familyId),
    foreignKey({
      columns: [table.familyId, table.createdByGuardianId],
      foreignColumns: [familyGuardians.familyId, familyGuardians.guardianId],
      name: 'activity_definition_guardian_family_fk',
    }),
  ],
);

export const activityAssignments = lifeOsSchema.table(
  'activity_assignments',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    childId: uuid('child_id').notNull(),
    activityDefinitionId: uuid('activity_definition_id').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    scheduleRrule: text('schedule_rrule').notNull(),
    scheduleTimezone: text('schedule_timezone').notNull(),
    localTargetTime: text('local_target_time').notNull(),
    availableOffsetMinutes: integer('available_offset_minutes').notNull(),
    opportunityEndOffsetMinutes: integer('opportunity_end_offset_minutes').notNull(),
    trackingMode: text('tracking_mode').notNull(),
    completionMode: text('completion_mode').notNull(),
    approvalMode: text('approval_mode').notNull(),
    progressMode: text('progress_mode').notNull(),
    xpMode: text('xp_mode').notNull(),
    xpAmount: integer('xp_amount'),
    reminderPolicy: jsonb('reminder_policy').notNull(),
    activeFrom: date('active_from', { mode: 'string' }).notNull(),
    activeUntil: date('active_until', { mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('activity_assignments_family_pair_uidx').on(table.id, table.familyId),
    index('activity_assignments_child_idx').on(table.familyId, table.childId),
    foreignKey({
      columns: [table.childId, table.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: 'activity_assignment_child_family_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.activityDefinitionId, table.familyId],
      foreignColumns: [activityDefinitions.id, activityDefinitions.familyId],
      name: 'activity_assignment_definition_family_fk',
    }).onDelete('cascade'),
  ],
);

export const activityInstances = lifeOsSchema.table(
  'activity_instances',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    childId: uuid('child_id').notNull(),
    assignmentId: uuid('assignment_id').notNull(),
    availableFrom: timestamp('available_from', { withTimezone: true }).notNull(),
    targetAt: timestamp('target_at', { withTimezone: true }).notNull(),
    opportunityEndsAt: timestamp('opportunity_ends_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('activity_instances_family_pair_uidx').on(table.id, table.familyId),
    uniqueIndex('activity_instances_assignment_target_uidx').on(table.assignmentId, table.targetAt),
    index('activity_instances_child_target_idx').on(table.familyId, table.childId, table.targetAt),
    foreignKey({
      columns: [table.childId, table.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: 'activity_instance_child_family_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.assignmentId, table.familyId],
      foreignColumns: [activityAssignments.id, activityAssignments.familyId],
      name: 'activity_instance_assignment_family_fk',
    }).onDelete('cascade'),
  ],
);

export const completionRecords = lifeOsSchema.table(
  'completion_records',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    activityInstanceId: uuid('activity_instance_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    reportedByKind: text('reported_by_kind').notNull(),
    reportedById: uuid('reported_by_id'),
    selfInitiated: boolean('self_initiated').notNull(),
    reminderCountAtCompletion: integer('reminder_count_at_completion').notNull().default(0),
    source: text('source').notNull(),
  },
  (table) => [
    uniqueIndex('completion_records_instance_uidx').on(table.activityInstanceId),
    index('completion_records_family_idx').on(table.familyId, table.recordedAt),
    foreignKey({
      columns: [table.activityInstanceId, table.familyId],
      foreignColumns: [activityInstances.id, activityInstances.familyId],
      name: 'completion_instance_family_fk',
    }).onDelete('cascade'),
  ],
);
