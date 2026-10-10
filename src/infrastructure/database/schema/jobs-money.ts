import {
  bigint as pgBigint,
  foreignKey,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { lifeOsSchema } from '../schema-root';
import { families, childProfiles } from './identity';
const amount = () => pgBigint('amount_minor', { mode: 'bigint' });
export const jobs = lifeOsSchema.table(
  'jobs',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    childId: uuid('child_id').notNull(),
    title: text('title').notNull(),
    criteria: text('criteria').notNull(),
    paymentMinor: pgBigint('payment_minor', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    termsVersion: integer('terms_version').notNull().default(1),
    acceptedTermsVersion: integer('accepted_terms_version'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('jobs_id_family_uidx').on(t.id, t.familyId),
    index('jobs_child_idx').on(t.familyId, t.childId),
    foreignKey({
      columns: [t.childId, t.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: 'jobs_child_family_fk',
    }),
  ],
);
export const jobRevisions = lifeOsSchema.table(
  'job_revisions',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id').notNull(),
    jobId: uuid('job_id').notNull(),
    termsVersion: integer('terms_version').notNull(),
    criteria: text('criteria').notNull(),
    paymentMinor: pgBigint('payment_minor', { mode: 'bigint' }).notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.jobId, t.familyId],
      foreignColumns: [jobs.id, jobs.familyId],
      name: 'job_revisions_job_fk',
    }),
  ],
);
export const moneyAccounts = lifeOsSchema.table(
  'money_accounts',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    childId: uuid('child_id').notNull(),
    bucket: text('bucket').notNull(),
    currency: text('currency').notNull(),
  },
  (t) => [
    uniqueIndex('money_accounts_child_bucket_uidx').on(t.familyId, t.childId, t.bucket),
    uniqueIndex('money_accounts_pair_uidx').on(t.id, t.familyId, t.childId),
    foreignKey({
      columns: [t.childId, t.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: 'money_account_child_family_fk',
    }),
  ],
);
export const moneyTransactions = lifeOsSchema.table(
  'money_transactions',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    childId: uuid('child_id').notNull(),
    kind: text('kind').notNull(),
    currency: text('currency').notNull(),
    jobId: uuid('job_id'),
    correctionOf: uuid('correction_of'),
    note: text('note').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('money_transactions_pair_uidx').on(t.id, t.familyId, t.childId),
    index('money_transactions_child_idx').on(t.familyId, t.childId, t.recordedAt),
    foreignKey({
      columns: [t.childId, t.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: 'money_tx_child_family_fk',
    }),
    foreignKey({
      columns: [t.jobId, t.familyId],
      foreignColumns: [jobs.id, jobs.familyId],
      name: 'money_tx_job_family_fk',
    }),
    foreignKey({
      columns: [t.correctionOf, t.familyId, t.childId],
      foreignColumns: [t.id, t.familyId, t.childId],
      name: 'money_tx_correction_fk',
    }),
  ],
);
export const moneyPostings = lifeOsSchema.table(
  'money_postings',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id').notNull(),
    childId: uuid('child_id').notNull(),
    transactionId: uuid('transaction_id').notNull(),
    accountId: uuid('account_id').notNull(),
    amountMinor: pgBigint('amount_minor', { mode: 'bigint' }).notNull(),
  },
  (t) => [
    index('money_postings_child_idx').on(t.familyId, t.childId),
    foreignKey({
      columns: [t.transactionId, t.familyId, t.childId],
      foreignColumns: [moneyTransactions.id, moneyTransactions.familyId, moneyTransactions.childId],
      name: 'money_postings_tx_fk',
    }),
    foreignKey({
      columns: [t.accountId, t.familyId, t.childId],
      foreignColumns: [moneyAccounts.id, moneyAccounts.familyId, moneyAccounts.childId],
      name: 'money_postings_account_fk',
    }),
  ],
);
export const savingGoals = lifeOsSchema.table(
  'saving_goals',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    childId: uuid('child_id').notNull(),
    title: text('title').notNull(),
    targetMinor: pgBigint('target_minor', { mode: 'bigint' }).notNull(),
    status: text('status').notNull().default('ACTIVE'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('saving_goals_pair_uidx').on(t.id, t.familyId, t.childId),
    foreignKey({
      columns: [t.childId, t.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: 'saving_goal_child_fk',
    }),
  ],
);
export const savingGoalAllocations = lifeOsSchema.table(
  'saving_goal_allocations',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id').notNull(),
    childId: uuid('child_id').notNull(),
    savingGoalId: uuid('saving_goal_id').notNull(),
    amountMinor: pgBigint('amount_minor', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.savingGoalId, t.familyId, t.childId],
      foreignColumns: [savingGoals.id, savingGoals.familyId, savingGoals.childId],
      name: 'saving_alloc_goal_fk',
    }),
  ],
);
