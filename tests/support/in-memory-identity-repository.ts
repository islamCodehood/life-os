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

export class InMemoryIdentityRepository implements IdentityRepository {
  families = new Map<FamilyId, Family>();
  guardians = new Map<GuardianId, GuardianProfile>();
  memberships: GuardianMembership[] = [];
  children = new Map<ChildId, ChildProfile>();
  preferences = new Map<ChildId, ExperiencePreference>();
  devices = new Map<DeviceId, HouseholdDevice & { tokenHash: string }>();
  pins = new Map<ChildId, ChildPinCredential>();
  sessions = new Map<ChildSessionId, ChildSession & { tokenHash: string }>();

  async findGuardianByProviderUserId(providerUserId: string) {
    return (
      [...this.guardians.values()].find(
        (guardian) => guardian.providerUserId === providerUserId,
      ) ?? null
    );
  }

  async listGuardianMemberships(guardianId: GuardianId) {
    return this.memberships.filter((membership) => membership.guardianId === guardianId);
  }

  async getFamily(familyId: FamilyId) {
    return this.families.get(familyId) ?? null;
  }

  async createFamilyWithOwner(input: {
    identity: GuardianIdentity;
    guardianId: GuardianId;
    familyId: FamilyId;
    name: string;
    timezone: string;
    currency: string;
  }) {
    const guardian: GuardianProfile = {
      id: input.guardianId,
      providerUserId: input.identity.providerUserId,
      displayName: input.identity.displayName,
    };
    const family: Family = {
      id: input.familyId,
      name: input.name,
      timezone: input.timezone,
      currency: input.currency,
      weeklyReviewDay: null,
      version: 1,
    };
    this.guardians.set(guardian.id, guardian);
    this.families.set(family.id, family);
    this.memberships.push({
      familyId: family.id,
      guardianId: guardian.id,
      role: 'OWNER',
    });
    return { family, guardian };
  }

  async createChild(input: {
    familyId: FamilyId;
    childId: ChildId;
    displayName: string;
    birthDate: string;
    avatarKey: string | null;
    experience: ExperiencePreference;
  }) {
    const child: ChildProfile = {
      id: input.childId,
      familyId: input.familyId,
      displayName: input.displayName,
      birthDate: input.birthDate,
      avatarKey: input.avatarKey,
      status: 'ACTIVE',
      version: 1,
    };
    this.children.set(child.id, child);
    this.preferences.set(child.id, input.experience);
    return child;
  }

  async getChild(familyId: FamilyId, childId: ChildId) {
    const child = this.children.get(childId);
    return child?.familyId === familyId ? child : null;
  }

  async listChildSummaries(familyId: FamilyId, asOfDate: string): Promise<ChildProfileSummary[]> {
    return [...this.children.values()]
      .filter((child) => child.familyId === familyId && child.status === 'ACTIVE')
      .map((child) => ({
        id: child.id,
        displayName: child.displayName,
        avatarKey: child.avatarKey,
        ageProfile: deriveAgeProfile(child.birthDate, asOfDate),
        experience: this.preferences.get(child.id) ?? {
          visualization: 'BALANCED',
          motion: 'FULL',
          themeKey: 'island',
        },
      }));
  }

  async updateExperiencePreference(
    familyId: FamilyId,
    childId: ChildId,
    preference: ExperiencePreference,
  ) {
    if (!(await this.getChild(familyId, childId))) throw new Error('Child not found.');
    this.preferences.set(childId, preference);
  }

  async registerDevice(input: {
    familyId: FamilyId;
    deviceId: DeviceId;
    label: string;
    tokenHash: string;
  }) {
    const device: HouseholdDevice & { tokenHash: string } = {
      id: input.deviceId,
      familyId: input.familyId,
      label: input.label,
      tokenHash: input.tokenHash,
      revokedAt: null,
    };
    this.devices.set(device.id, device);
    return device;
  }

  async revokeDevice(familyId: FamilyId, deviceId: DeviceId, revokedAt: Date) {
    const device = this.devices.get(deviceId);
    if (!device || device.familyId !== familyId || device.revokedAt) return false;
    device.revokedAt = revokedAt;
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId && session.deviceId === deviceId && !session.revokedAt) {
        session.revokedAt = revokedAt;
      }
    }
    return true;
  }

  async findTrustedDeviceByTokenHash(tokenHash: string) {
    return (
      [...this.devices.values()].find(
        (device) => device.tokenHash === tokenHash && !device.revokedAt,
      ) ?? null
    );
  }

  async getPinCredential(familyId: FamilyId, childId: ChildId) {
    const credential = this.pins.get(childId);
    return credential?.familyId === familyId ? credential : null;
  }

  async setPinCredential(input: { familyId: FamilyId; childId: ChildId; pinHash: string }) {
    this.pins.set(input.childId, {
      familyId: input.familyId,
      childId: input.childId,
      pinHash: input.pinHash,
      failedAttempts: 0,
      lockedUntil: null,
      version: (this.pins.get(input.childId)?.version ?? 0) + 1,
    });
  }

  async recordPinFailure(input: {
    familyId: FamilyId;
    childId: ChildId;
    maxAttempts: number;
    lockedUntil: Date;
  }) {
    const credential = await this.getPinCredential(input.familyId, input.childId);
    if (!credential) return null;
    credential.failedAttempts += 1;
    if (credential.failedAttempts >= input.maxAttempts) credential.lockedUntil = input.lockedUntil;
    return credential;
  }

  async clearPinFailures(familyId: FamilyId, childId: ChildId) {
    const credential = await this.getPinCredential(familyId, childId);
    if (!credential) return;
    credential.failedAttempts = 0;
    credential.lockedUntil = null;
  }

  async createChildSession(input: {
    sessionId: ChildSessionId;
    familyId: FamilyId;
    childId: ChildId;
    deviceId: DeviceId;
    tokenHash: string;
    expiresAt: Date;
  }) {
    const session: ChildSession & { tokenHash: string } = {
      id: input.sessionId,
      familyId: input.familyId,
      childId: input.childId,
      deviceId: input.deviceId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findActiveChildSessionByTokenHash(tokenHash: string, now: Date) {
    return (
      [...this.sessions.values()].find((session) => {
        const device = this.devices.get(session.deviceId);
        return (
          session.tokenHash === tokenHash &&
          !session.revokedAt &&
          session.expiresAt > now &&
          Boolean(device) &&
          !device?.revokedAt
        );
      }) ?? null
    );
  }

  async revokeChildSession(familyId: FamilyId, sessionId: ChildSessionId, revokedAt: Date) {
    const session = this.sessions.get(sessionId);
    if (!session || session.familyId !== familyId || session.revokedAt) return false;
    session.revokedAt = revokedAt;
    return true;
  }

  async revokeChildSessionsForChild(familyId: FamilyId, childId: ChildId, revokedAt: Date) {
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId && session.childId === childId && !session.revokedAt) {
        session.revokedAt = revokedAt;
      }
    }
  }
}
