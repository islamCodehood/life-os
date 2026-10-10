import { foreignKey, index, integer, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { lifeOsSchema } from '../schema-root';
import { childProfiles, families } from './identity';
import { domainEvents } from './system';

export const xpLedger = lifeOsSchema.table('xp_ledger', {
  id: uuid('id').primaryKey(),
  familyId: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  childId: uuid('child_id').notNull(),
  skillKey: text('skill_key').notNull(),
  entryType: text('entry_type').notNull(),
  amount: integer('amount').notNull(),
  sourceEventId: uuid('source_event_id').notNull().references(() => domainEvents.id),
  correctionOf: uuid('correction_of'),
  correctionReason: text('correction_reason'),
  occurredAt: timestamp('occurred_at',{ withTimezone: true }).notNull(),
  recordedAt: timestamp('recorded_at',{ withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex('xp_ledger_id_family_unique').on(table.id,table.familyId),
  uniqueIndex('xp_ledger_source_event_unique').on(table.sourceEventId),
  uniqueIndex('xp_ledger_one_correction_unique').on(table.correctionOf).where(sql`${table.correctionOf} IS NOT NULL`),
  index('xp_ledger_child_skill_idx').on(table.familyId,table.childId,table.skillKey),
  foreignKey({
    columns:[table.childId,table.familyId],
    foreignColumns:[childProfiles.id, childProfiles.familyId],
    name:'xp_ledger_child_family_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns:[table.correctionOf,table.familyId],
    foreignColumns:[table.id,table.familyId],
    name:'xp_ledger_correction_family_fk',
  }),
]);
