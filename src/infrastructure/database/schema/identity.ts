import {
  char,
  date,
  index,
  integer,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { lifeOsSchema } from '../schema-root';

export const families = lifeOsSchema.table('families', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  weeklyReviewDay: smallint('weekly_review_day'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
});

export const guardianProfiles = lifeOsSchema.table(
  'guardian_profiles',
  {
    id: uuid('id').primaryKey(),
    supabaseUserId: uuid('supabase_user_id').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [uniqueIndex('guardian_supabase_user_uidx').on(table.supabaseUserId)],
);

export const familyGuardians = lifeOsSchema.table(
  'family_guardians',
  {
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    guardianId: uuid('guardian_id')
      .notNull()
      .references(() => guardianProfiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.familyId, table.guardianId], name: 'family_guardians_pk' }),
    index('family_guardians_guardian_idx').on(table.guardianId),
  ],
);

export const childProfiles = lifeOsSchema.table(
  'child_profiles',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
    avatarKey: text('avatar_key'),
    status: text('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('child_family_pair_uidx').on(table.id, table.familyId),
    index('child_family_idx').on(table.familyId),
  ],
);

export const experiencePreferences = lifeOsSchema.table(
  'experience_preferences',
  {
    childId: uuid('child_id')
      .primaryKey()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    visualization: text('visualization').notNull(),
    motion: text('motion').notNull(),
    themeKey: text('theme_key').notNull().default('island'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [index('experience_preferences_family_idx').on(table.familyId)],
);

export const householdDevices = lifeOsSchema.table(
  'household_devices',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    trustedAt: timestamp('trusted_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('household_devices_token_hash_uidx').on(table.tokenHash),
    index('household_devices_family_idx').on(table.familyId),
  ],
);

export const childPinCredentials = lifeOsSchema.table(
  'child_pin_credentials',
  {
    childId: uuid('child_id')
      .primaryKey()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    pinHash: text('pin_hash').notNull(),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [index('child_pin_credentials_family_idx').on(table.familyId)],
);

export const childSessions = lifeOsSchema.table(
  'child_sessions',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => householdDevices.id, { onDelete: 'cascade' }),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('child_sessions_token_hash_uidx').on(table.tokenHash),
    index('child_sessions_child_idx').on(table.familyId, table.childId),
    index('child_sessions_device_idx').on(table.deviceId),
  ],
);
