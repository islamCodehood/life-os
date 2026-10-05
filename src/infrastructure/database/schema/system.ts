import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { lifeOsSchema } from '../schema-root';
import { families } from './identity';

export const processedCommands = lifeOsSchema.table('processed_commands', {
  commandId: uuid('command_id').primaryKey(),
  requestHash: text('request_hash').notNull(),
  actorKind: text('actor_kind').notNull(),
  actorId: uuid('actor_id'),
  familyId: uuid('family_id'),
  status: text('status').notNull(),
  responseJson: jsonb('response_json'),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const domainEvents = lifeOsSchema.table('domain_events', {
  id: uuid('id').primaryKey(),
  familyId: uuid('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb('payload').notNull(),
});
