import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { lifeOsSchema } from '../schema-root';

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
