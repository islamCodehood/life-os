import type { GuardianIdentity } from '@/src/application/auth/guardian-auth-gateway';
import type {
  ChildProfile,
  ChildProfileSummary,
  ChildPinCredential,
  ChildSession,
  Family,
  GuardianProfile,
  HouseholdDevice,
} from '@/src/domain/identity/entities';
import type { ExperiencePreference } from '@/src/domain/identity/experience';
import type {
  ChildId,
  ChildSessionId,
  DeviceId,
  FamilyId,
  GuardianId,
} from '@/src/domain/shared/id';

export interface GuardianMembership {
  familyId: FamilyId;
  guardianId: GuardianId;
  role: 'OWNER' | 'GUARDIAN';
}

export interface IdentityRepository {
  findGuardianByProviderUserId(providerUserId: string): Promise<GuardianProfile | null>;
  listGuardianMemberships(guardianId: GuardianId): Promise<GuardianMembership[]>;
  getFamily(familyId: FamilyId): Promise<Family | null>;

  createFamilyWithOwner(input: {
    identity: GuardianIdentity;
    guardianId: GuardianId;
    familyId: FamilyId;
    name: string;
    timezone: string;
    currency: string;
  }): Promise<{ family: Family; guardian: GuardianProfile }>;

  createChild(input: {
    familyId: FamilyId;
    childId: ChildId;
    displayName: string;
    birthDate: string;
    avatarKey: string | null;
    experience: ExperiencePreference;
  }): Promise<ChildProfile>;

  getChild(familyId: FamilyId, childId: ChildId): Promise<ChildProfile | null>;
  listChildSummaries(familyId: FamilyId, asOfDate: string): Promise<ChildProfileSummary[]>;
  updateExperiencePreference(
    familyId: FamilyId,
    childId: ChildId,
    preference: ExperiencePreference,
  ): Promise<void>;

  registerDevice(input: {
    familyId: FamilyId;
    deviceId: DeviceId;
    label: string;
    tokenHash: string;
  }): Promise<HouseholdDevice>;
  revokeDevice(familyId: FamilyId, deviceId: DeviceId, revokedAt: Date): Promise<boolean>;
  findTrustedDeviceByTokenHash(tokenHash: string): Promise<HouseholdDevice | null>;

  getPinCredential(familyId: FamilyId, childId: ChildId): Promise<ChildPinCredential | null>;
  setPinCredential(input: { familyId: FamilyId; childId: ChildId; pinHash: string }): Promise<void>;
  recordPinFailure(input: {
    familyId: FamilyId;
    childId: ChildId;
    maxAttempts: number;
    lockedUntil: Date;
  }): Promise<ChildPinCredential | null>;
  clearPinFailures(familyId: FamilyId, childId: ChildId): Promise<void>;

  createChildSession(input: {
    sessionId: ChildSessionId;
    familyId: FamilyId;
    childId: ChildId;
    deviceId: DeviceId;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<ChildSession>;
  findActiveChildSessionByTokenHash(tokenHash: string, now: Date): Promise<ChildSession | null>;
  revokeChildSession(
    familyId: FamilyId,
    sessionId: ChildSessionId,
    revokedAt: Date,
  ): Promise<boolean>;
  revokeChildSessionsForChild(familyId: FamilyId, childId: ChildId, revokedAt: Date): Promise<void>;
}
