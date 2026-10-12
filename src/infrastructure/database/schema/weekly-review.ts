import {
  date,
  foreignKey,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { lifeOsSchema } from '../schema-root';
import { childProfiles, families, familyGuardians } from './identity';

export const weeklyReviews = lifeOsSchema.table(
  'weekly_reviews',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    weekEnd: date('week_end', { mode: 'string' }).notNull(),
    reviewOn: date('review_on', { mode: 'string' }).notNull(),
    timezone: text('timezone').notNull(),
    status: text('status').notNull().default('OPEN'),
    nextFocus: text('next_focus'),
    version: integer('version').notNull().default(1),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('weekly_reviews_id_family_pair').on(t.id, t.familyId),
    uniqueIndex('weekly_reviews_one_per_week').on(t.familyId, t.weekStart),
    index('weekly_reviews_family_recent').on(t.familyId, t.weekStart),
  ],
);
export const weeklyReviewEntries = lifeOsSchema.table(
  'weekly_review_entries',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id').notNull(),
    reviewId: uuid('review_id').notNull(),
    authorKey: text('author_key').notNull(),
    authorKind: text('author_kind').notNull(),
    authorChildId: uuid('author_child_id'),
    authorGuardianId: uuid('author_guardian_id'),
    prompt: text('prompt').notNull(),
    text: text('response_text').notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('weekly_review_entries_unique').on(t.reviewId, t.authorKey, t.prompt),
    index('weekly_review_entries_review').on(t.familyId, t.reviewId),
    foreignKey({
      columns: [t.reviewId, t.familyId],
      foreignColumns: [weeklyReviews.id, weeklyReviews.familyId],
      name: 'weekly_review_entries_review_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.authorChildId, t.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: 'weekly_review_entries_child_fk',
    }),
    foreignKey({
      columns: [t.familyId, t.authorGuardianId],
      foreignColumns: [familyGuardians.familyId, familyGuardians.guardianId],
      name: 'weekly_review_entries_guardian_fk',
    }),
  ],
);
