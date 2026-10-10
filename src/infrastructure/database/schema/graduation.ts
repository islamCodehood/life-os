import {
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { lifeOsSchema } from '../schema-root';
import { activityAssignments } from './activity';
import { childProfiles, families } from './identity';

export const graduationEvidenceSnapshots = lifeOsSchema.table(
  'graduation_evidence_snapshots',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    assignmentId: uuid('assignment_id').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    metrics: jsonb('metrics').notNull(),
  },
  (table) => [
    index('graduation_evidence_family_idx').on(table.familyId, table.assignmentId),
    foreignKey({
      columns: [table.assignmentId, table.familyId],
      foreignColumns: [activityAssignments.id, activityAssignments.familyId],
      name: 'graduation_evidence_assignment_fk',
    }).onDelete('cascade'),
  ],
);

export const graduationRecords = lifeOsSchema.table(
  'graduation_records',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    childId: uuid('child_id').notNull(),
    assignmentId: uuid('assignment_id').notNull(),
    status: text('status').notNull().default('GRADUATED'),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull(),
    approvedBy: uuid('approved_by').notNull(),
    monitoringIntervalDays: integer('monitoring_interval_days').notNull().default(14),
    lastObservedAt: timestamp('last_observed_at', { withTimezone: true }),
    reactivatedAt: timestamp('reactivated_at', { withTimezone: true }),
    reactivatedBy: uuid('reactivated_by'),
  },
  (table) => [
    index('graduation_record_child_idx').on(table.familyId, table.childId),
    uniqueIndex('graduation_one_active_per_assignment_uidx')
      .on(table.assignmentId)
      .where(sql`${table.status} = 'GRADUATED'`),
    foreignKey({
      columns: [table.assignmentId, table.familyId],
      foreignColumns: [activityAssignments.id, activityAssignments.familyId],
      name: 'graduation_record_assignment_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.childId, table.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: 'graduation_record_child_fk',
    }).onDelete('cascade'),
  ],
);

export const graduationObservations = lifeOsSchema.table(
  'graduation_observations',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    graduationRecordId: uuid('graduation_record_id')
      .notNull()
      .references(() => graduationRecords.id, { onDelete: 'cascade' }),
    recordedBy: uuid('recorded_by').notNull(),
    result: text('result').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('graduation_observations_record_idx').on(
      table.familyId,
      table.graduationRecordId,
      table.observedAt,
    ),
  ],
);

export const graduationSuggestions = lifeOsSchema.table(
  'graduation_suggestions',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    childId: uuid('child_id').notNull(),
    assignmentId: uuid('assignment_id').notNull(),
    graduationRecordId: uuid('graduation_record_id').references(() => graduationRecords.id),
    evidenceSnapshotId: uuid('evidence_snapshot_id').references(
      () => graduationEvidenceSnapshots.id,
    ),
    kind: text('kind').notNull(),
    origin: text('origin').notNull(),
    status: text('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: uuid('decided_by'),
  },
  (table) => [
    index('graduation_suggestion_family_idx').on(table.familyId, table.childId),
    uniqueIndex('graduation_one_pending_suggestion_uidx')
      .on(table.assignmentId, table.kind)
      .where(sql`${table.status} = 'PENDING'`),
    foreignKey({
      columns: [table.assignmentId, table.familyId],
      foreignColumns: [activityAssignments.id, activityAssignments.familyId],
      name: 'graduation_suggestion_assignment_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.childId, table.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: 'graduation_suggestion_child_fk',
    }).onDelete('cascade'),
  ],
);
