import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { GuardianIdentity } from '@/src/application/auth/guardian-auth-gateway';
import type {
  GuardianMembership,
  IdentityRepository,
} from '@/src/application/identity/identity-repository';
import type {
  ChildProfile,
  ChildProfileSummary,
  ChildPinCredential,
  ChildSession,
  Family,
  GuardianProfile,
  HouseholdDevice,
} from '@/src/domain/identity/entities';
import { deriveAgeProfile } from '@/src/domain/identity/experience';
import type { ExperiencePreference } from '@/src/domain/identity/experience';
import type {
  ChildId,
  ChildSessionId,
  DeviceId,
  FamilyId,
  GuardianId,
} from '@/src/domain/shared/id';
import * as schema from '@/src/infrastructure/database/schema';

type Db = NodePgDatabase<typeof schema>;

function familyRow(row: typeof schema.families.$inferSelect): Family {
  return {
    id: row.id as FamilyId,
    name: row.name,
    timezone: row.timezone,
    currency: row.currency,
    weeklyReviewDay: row.weeklyReviewDay,
    version: row.version,
  };
}

function guardianRow(row: typeof schema.guardianProfiles.$inferSelect): GuardianProfile {
  return {
    id: row.id as GuardianId,
    providerUserId: row.supabaseUserId,
    displayName: row.displayName,
  };
}

function childRow(row: typeof schema.childProfiles.$inferSelect): ChildProfile {
  return {
    id: row.id as ChildId,
    familyId: row.familyId as FamilyId,
    displayName: row.displayName,
    birthDate: row.birthDate,
    avatarKey: row.avatarKey,
    status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    version: row.version,
  };
}

export class PostgresIdentityRepository implements IdentityRepository {
  constructor(private readonly db: Db) {}

  async findGuardianByProviderUserId(providerUserId: string) {
    const [row] = await this.db
      .select()
      .from(schema.guardianProfiles)
      .where(eq(schema.guardianProfiles.supabaseUserId, providerUserId))
      .limit(1);

    return row ? guardianRow(row) : null;
  }

  async listGuardianMemberships(guardianId: GuardianId): Promise<GuardianMembership[]> {
    const rows = await this.db
      .select()
      .from(schema.familyGuardians)
      .where(eq(schema.familyGuardians.guardianId, guardianId));

    return rows.map((row) => ({
      familyId: row.familyId as FamilyId,
      guardianId: row.guardianId as GuardianId,
      role: row.role === 'GUARDIAN' ? 'GUARDIAN' : 'OWNER',
    }));
  }

  async createFamilyWithOwner(input: {
    identity: GuardianIdentity;
    guardianId: GuardianId;
    familyId: FamilyId;
    name: string;
    timezone: string;
    currency: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [guardian] = await tx
        .insert(schema.guardianProfiles)
        .values({
          id: input.guardianId,
          supabaseUserId: input.identity.providerUserId,
          displayName: input.identity.displayName,
        })
        .onConflictDoUpdate({
          target: schema.guardianProfiles.supabaseUserId,
          set: {
            displayName: input.identity.displayName,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!guardian) throw new Error('Failed to create guardian profile.');

      const [family] = await tx
        .insert(schema.families)
        .values({
          id: input.familyId,
          name: input.name,
          timezone: input.timezone,
          currency: input.currency,
        })
        .returning();

      if (!family) throw new Error('Failed to create family.');

      await tx.insert(schema.familyGuardians).values({
        familyId: family.id,
        guardianId: guardian.id,
        role: 'OWNER',
      });

      return { family: familyRow(family), guardian: guardianRow(guardian) };
    });
  }

  async createChild(input: {
    familyId: FamilyId;
    childId: ChildId;
    displayName: string;
    birthDate: string;
    avatarKey: string | null;
    experience: ExperiencePreference;
  }) {
    return this.db.transaction(async (tx) => {
      const [child] = await tx
        .insert(schema.childProfiles)
        .values({
          id: input.childId,
          familyId: input.familyId,
          displayName: input.displayName,
          birthDate: input.birthDate,
          avatarKey: input.avatarKey,
        })
        .returning();

      if (!child) throw new Error('Failed to create child profile.');

      await tx.insert(schema.experiencePreferences).values({
        childId: child.id,
        familyId: input.familyId,
        visualization: input.experience.visualization,
        motion: input.experience.motion,
        themeKey: input.experience.themeKey,
      });

      return childRow(child);
    });
  }

  async getChild(familyId: FamilyId, childId: ChildId) {
    const [row] = await this.db
      .select()
      .from(schema.childProfiles)
      .where(
        and(
          eq(schema.childProfiles.familyId, familyId),
          eq(schema.childProfiles.id, childId),
        ),
      )
      .limit(1);

    return row ? childRow(row) : null;
  }

  async listChildSummaries(familyId: FamilyId, asOfDate: string): Promise<ChildProfileSummary[]> {
    const rows = await this.db
      .select({
        child: schema.childProfiles,
        experience: schema.experiencePreferences,
      })
      .from(schema.childProfiles)
      .innerJoin(
        schema.experiencePreferences,
        and(
          eq(schema.experiencePreferences.childId, schema.childProfiles.id),
          eq(schema.experiencePreferences.familyId, schema.childProfiles.familyId),
        ),
      )
      .where(
        and(
          eq(schema.childProfiles.familyId, familyId),
          eq(schema.childProfiles.status, 'ACTIVE'),
        ),
      );

    return rows.map(({ child, experience }) => ({
      id: child.id as ChildId,
      displayName: child.displayName,
      avatarKey: child.avatarKey,
      ageProfile: deriveAgeProfile(child.birthDate, asOfDate),
      experience: {
        visualization:
          experience.visualization === 'IMMERSIVE'
            ? 'IMMERSIVE'
            : experience.visualization === 'FOCUSED'
              ? 'FOCUSED'
              : 'BALANCED',
        motion:
          experience.motion === 'REDUCED'
            ? 'REDUCED'
            : experience.motion === 'OFF'
              ? 'OFF'
              : 'FULL',
        themeKey: experience.themeKey,
      },
    }));
  }

  async updateExperiencePreference(
    familyId: FamilyId,
    childId: ChildId,
    preference: ExperiencePreference,
  ) {
    const updated = await this.db
      .update(schema.experiencePreferences)
      .set({
        visualization: preference.visualization,
        motion: preference.motion,
        themeKey: preference.themeKey,
        updatedAt: new Date(),
        version: sql`${schema.experiencePreferences.version} + 1`,
      })
      .where(
        and(
          eq(schema.experiencePreferences.familyId, familyId),
          eq(schema.experiencePreferences.childId, childId),
        ),
      )
      .returning({ childId: schema.experiencePreferences.childId });

    if (updated.length === 0) {
      throw new Error('Experience preference not found.');
    }
  }

  async registerDevice(input: {
    familyId: FamilyId;
    deviceId: DeviceId;
    label: string;
    tokenHash: string;
  }) {
    const [row] = await this.db
      .insert(schema.householdDevices)
      .values({
        id: input.deviceId,
        familyId: input.familyId,
        label: input.label,
        tokenHash: input.tokenHash,
      })
      .returning();

    if (!row) throw new Error('Failed to register household device.');

    return {
      id: row.id as DeviceId,
      familyId: row.familyId as FamilyId,
      label: row.label,
      revokedAt: row.revokedAt,
    } satisfies HouseholdDevice;
  }

  async revokeDevice(familyId: FamilyId, deviceId: DeviceId, revokedAt: Date) {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(schema.householdDevices)
        .set({
          revokedAt,
          version: sql`${schema.householdDevices.version} + 1`,
        })
        .where(
          and(
            eq(schema.householdDevices.familyId, familyId),
            eq(schema.householdDevices.id, deviceId),
            isNull(schema.householdDevices.revokedAt),
          ),
        )
        .returning({ id: schema.householdDevices.id });

      if (rows.length === 0) return false;

      await tx
        .update(schema.childSessions)
        .set({ revokedAt })
        .where(
          and(
            eq(schema.childSessions.familyId, familyId),
            eq(schema.childSessions.deviceId, deviceId),
            isNull(schema.childSessions.revokedAt),
          ),
        );

      return true;
    });
  }

  async findTrustedDeviceByTokenHash(tokenHash: string) {
    const [row] = await this.db
      .select()
      .from(schema.householdDevices)
      .where(
        and(
          eq(schema.householdDevices.tokenHash, tokenHash),
          isNull(schema.householdDevices.revokedAt),
        ),
      )
      .limit(1);

    if (!row) return null;

    return {
      id: row.id as DeviceId,
      familyId: row.familyId as FamilyId,
      label: row.label,
      revokedAt: row.revokedAt,
    } satisfies HouseholdDevice;
  }

  async getPinCredential(familyId: FamilyId, childId: ChildId) {
    const [row] = await this.db
      .select()
      .from(schema.childPinCredentials)
      .where(
        and(
          eq(schema.childPinCredentials.familyId, familyId),
          eq(schema.childPinCredentials.childId, childId),
        ),
      )
      .limit(1);

    if (!row) return null;

    return {
      familyId: row.familyId as FamilyId,
      childId: row.childId as ChildId,
      pinHash: row.pinHash,
      failedAttempts: row.failedAttempts,
      lockedUntil: row.lockedUntil,
      version: row.version,
    } satisfies ChildPinCredential;
  }

  async setPinCredential(input: { familyId: FamilyId; childId: ChildId; pinHash: string }) {
    await this.db
      .insert(schema.childPinCredentials)
      .values({
        familyId: input.familyId,
        childId: input.childId,
        pinHash: input.pinHash,
        failedAttempts: 0,
        lockedUntil: null,
      })
      .onConflictDoUpdate({
        target: schema.childPinCredentials.childId,
        set: {
          pinHash: input.pinHash,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
          version: sql`${schema.childPinCredentials.version} + 1`,
        },
      });
  }

  async recordPinFailure(input: {
    familyId: FamilyId;
    childId: ChildId;
    maxAttempts: number;
    lockedUntil: Date;
  }) {
    const [row] = await this.db
      .update(schema.childPinCredentials)
      .set({
        failedAttempts: sql`${schema.childPinCredentials.failedAttempts} + 1`,
        lockedUntil: sql`CASE
          WHEN ${schema.childPinCredentials.failedAttempts} + 1 >= ${input.maxAttempts}
          THEN ${input.lockedUntil}
          ELSE ${schema.childPinCredentials.lockedUntil}
        END`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.childPinCredentials.familyId, input.familyId),
          eq(schema.childPinCredentials.childId, input.childId),
        ),
      )
      .returning();

    if (!row) return null;

    return {
      familyId: row.familyId as FamilyId,
      childId: row.childId as ChildId,
      pinHash: row.pinHash,
      failedAttempts: row.failedAttempts,
      lockedUntil: row.lockedUntil,
      version: row.version,
    } satisfies ChildPinCredential;
  }

  async clearPinFailures(familyId: FamilyId, childId: ChildId) {
    await this.db
      .update(schema.childPinCredentials)
      .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.childPinCredentials.familyId, familyId),
          eq(schema.childPinCredentials.childId, childId),
        ),
      );
  }

  async createChildSession(input: {
    sessionId: ChildSessionId;
    familyId: FamilyId;
    childId: ChildId;
    deviceId: DeviceId;
    tokenHash: string;
    expiresAt: Date;
  }) {
    const [row] = await this.db
      .insert(schema.childSessions)
      .values({
        id: input.sessionId,
        familyId: input.familyId,
        childId: input.childId,
        deviceId: input.deviceId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      })
      .returning();

    if (!row) throw new Error('Failed to create child session.');

    return {
      id: row.id as ChildSessionId,
      familyId: row.familyId as FamilyId,
      childId: row.childId as ChildId,
      deviceId: row.deviceId as DeviceId,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    } satisfies ChildSession;
  }

  async findActiveChildSessionByTokenHash(tokenHash: string, now: Date) {
    const [row] = await this.db
      .select({ session: schema.childSessions })
      .from(schema.childSessions)
      .innerJoin(
        schema.householdDevices,
        eq(schema.householdDevices.id, schema.childSessions.deviceId),
      )
      .where(
        and(
          eq(schema.childSessions.tokenHash, tokenHash),
          isNull(schema.childSessions.revokedAt),
          gt(schema.childSessions.expiresAt, now),
          isNull(schema.householdDevices.revokedAt),
        ),
      )
      .limit(1);

    if (!row) return null;

    return {
      id: row.session.id as ChildSessionId,
      familyId: row.session.familyId as FamilyId,
      childId: row.session.childId as ChildId,
      deviceId: row.session.deviceId as DeviceId,
      expiresAt: row.session.expiresAt,
      revokedAt: row.session.revokedAt,
    } satisfies ChildSession;
  }

  async revokeChildSession(familyId: FamilyId, sessionId: ChildSessionId, revokedAt: Date) {
    const rows = await this.db
      .update(schema.childSessions)
      .set({ revokedAt })
      .where(
        and(
          eq(schema.childSessions.familyId, familyId),
          eq(schema.childSessions.id, sessionId),
          isNull(schema.childSessions.revokedAt),
        ),
      )
      .returning({ id: schema.childSessions.id });

    return rows.length > 0;
  }

  async revokeChildSessionsForChild(familyId: FamilyId, childId: ChildId, revokedAt: Date) {
    await this.db
      .update(schema.childSessions)
      .set({ revokedAt })
      .where(
        and(
          eq(schema.childSessions.familyId, familyId),
          eq(schema.childSessions.childId, childId),
          isNull(schema.childSessions.revokedAt),
        ),
      );
  }
}
