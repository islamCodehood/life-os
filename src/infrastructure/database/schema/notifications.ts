import {
  boolean,
  foreignKey,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { lifeOsSchema } from '../schema-root';
import { families } from './identity';
export const notificationPreferences = lifeOsSchema.table(
  'notification_preferences',
  {
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    actorKey: text('actor_key').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    quietStart: text('quiet_start').notNull().default('21:00'),
    quietEnd: text('quiet_end').notNull().default('07:00'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.actorKey], name: 'notification_preferences_pk' })],
);
export const pushSubscriptions = lifeOsSchema.table(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    actorKey: text('actor_key').notNull(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    authSecret: text('auth_secret').notNull(),
    locale: text('locale').notNull().default('en'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('push_subscriptions_endpoint_unique').on(t.endpoint),
    index('push_subscriptions_actor_idx').on(t.familyId, t.actorKey),
    foreignKey({
      columns: [t.familyId, t.actorKey],
      foreignColumns: [notificationPreferences.familyId, notificationPreferences.actorKey],
      name: 'push_subscriptions_actor_pref_fk',
    }).onDelete('cascade'),
  ],
);
export const notificationIntents = lifeOsSchema.table(
  'notification_intents',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    actorKey: text('actor_key').notNull(),
    kind: text('kind').notNull(),
    sourceKey: text('source_key').notNull(),
    targetPath: text('target_path').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('notification_intent_unique').on(t.familyId, t.actorKey, t.sourceKey)],
);
export const outboxMessages = lifeOsSchema.table(
  'outbox_messages',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    intentId: uuid('intent_id')
      .notNull()
      .references(() => notificationIntents.id, { onDelete: 'cascade' }),
    messageType: text('message_type').notNull().default('SEND_PUSH'),
    status: text('status').notNull().default('PENDING'),
    attemptCount: integer('attempt_count').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('outbox_intent_unique').on(t.intentId),
    index('outbox_claim_idx').on(t.status, t.availableAt, t.createdAt),
  ],
);
export const schedulerRuns = lifeOsSchema.table(
  'scheduler_runs',
  {
    id: uuid('id').primaryKey(),
    jobKey: text('job_key').notNull(),
    bucket: timestamp('bucket', { withTimezone: true }).notNull(),
    status: text('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    errorCode: text('error_code'),
  },
  (t) => [uniqueIndex('scheduler_run_bucket_unique').on(t.jobKey, t.bucket)],
);
