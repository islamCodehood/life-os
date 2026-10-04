import type {
  ChildId,
  ChildSessionId,
  DeviceId,
  FamilyId,
  GuardianId,
} from '@/src/domain/shared/id';
import type { ExperiencePreference } from './experience';

export interface Family {
  id: FamilyId;
  name: string;
  timezone: string;
  currency: string;
  weeklyReviewDay: number | null;
  version: number;
}

export interface GuardianProfile {
  id: GuardianId;
  providerUserId: string;
  displayName: string;
}

export interface ChildProfile {
  id: ChildId;
  familyId: FamilyId;
  displayName: string;
  birthDate: string;
  avatarKey: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

export interface HouseholdDevice {
  id: DeviceId;
  familyId: FamilyId;
  label: string;
  revokedAt: Date | null;
}

export interface ChildPinCredential {
  familyId: FamilyId;
  childId: ChildId;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
  version: number;
}

export interface ChildSession {
  id: ChildSessionId;
  familyId: FamilyId;
  childId: ChildId;
  deviceId: DeviceId;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface ChildProfileSummary {
  id: ChildId;
  displayName: string;
  avatarKey: string | null;
  ageProfile: string | null;
  experience: ExperiencePreference;
}
