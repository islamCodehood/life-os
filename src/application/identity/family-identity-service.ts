import type { ActorContext } from '@/src/application/auth/actor-context';
import type { GuardianIdentity } from '@/src/application/auth/guardian-auth-gateway';
import type { PinHasher } from '@/src/application/auth/pin-hasher';
import { deriveAgeProfile, recommendedVisualization } from '@/src/domain/identity/experience';
import type { ExperiencePreference } from '@/src/domain/identity/experience';
import { newId } from '@/src/domain/shared/id';
import type { ChildId, DeviceId, FamilyId, GuardianId } from '@/src/domain/shared/id';
import type { IdentityRepository } from './identity-repository';

export class IdentityDomainError extends Error {
  constructor(
    readonly code:
      | 'FORBIDDEN'
      | 'RESOURCE_NOT_FOUND'
      | 'DOMAIN_RULE_VIOLATION'
      | 'VALIDATION_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'IdentityDomainError';
  }
}

function requireGuardian(actor: ActorContext): Extract<ActorContext, { kind: 'GUARDIAN' }> {
  if (actor.kind !== 'GUARDIAN') {
    throw new IdentityDomainError('FORBIDDEN', 'Guardian permission is required.');
  }

  return actor;
}

export interface PinPolicy {
  minLength: number;
  maxLength: number;
}

export class FamilyIdentityService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly pinHasher: PinHasher,
    private readonly pinPolicy: PinPolicy,
  ) {}

  async createFamily(
    identity: GuardianIdentity,
    input: { name: string; timezone: string; currency: string },
  ) {
    const name = input.name.trim();
    const timezone = input.timezone.trim();
    const currency = input.currency.trim().toUpperCase();

    if (!name || !timezone || !/^[A-Z]{3}$/.test(currency)) {
      throw new IdentityDomainError('VALIDATION_FAILED', 'Family details are invalid.');
    }

    return this.repository.createFamilyWithOwner({
      identity,
      guardianId: newId<'GuardianId'>() as GuardianId,
      familyId: newId<'FamilyId'>() as FamilyId,
      name,
      timezone,
      currency,
    });
  }

  async createChild(
    actor: ActorContext,
    input: {
      displayName: string;
      birthDate: string;
      avatarKey?: string | null;
      asOfDate: string;
    },
  ) {
    const guardian = requireGuardian(actor);
    const ageProfile = deriveAgeProfile(input.birthDate, input.asOfDate);

    if (!ageProfile) {
      throw new IdentityDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Child age must be inside the supported 6–17 family-pilot range.',
      );
    }

    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new IdentityDomainError('VALIDATION_FAILED', 'Child display name is required.');
    }

    const experience: ExperiencePreference = {
      visualization: recommendedVisualization(ageProfile),
      motion: 'FULL',
      themeKey: 'island',
    };

    const child = await this.repository.createChild({
      familyId: guardian.familyId,
      childId: newId<'ChildId'>() as ChildId,
      displayName,
      birthDate: input.birthDate,
      avatarKey: input.avatarKey ?? null,
      experience,
    });

    return { child, ageProfile, experience };
  }

  async updateExperiencePreference(
    actor: ActorContext,
    childId: ChildId,
    preference: ExperiencePreference,
  ) {
    const guardian = requireGuardian(actor);
    const child = await this.repository.getChild(guardian.familyId, childId);

    if (!child) {
      throw new IdentityDomainError('RESOURCE_NOT_FOUND', 'Child profile was not found.');
    }

    await this.repository.updateExperiencePreference(guardian.familyId, childId, preference);
  }

  async setChildPin(actor: ActorContext, childId: ChildId, pin: string) {
    const guardian = requireGuardian(actor);
    const child = await this.repository.getChild(guardian.familyId, childId);

    if (!child) {
      throw new IdentityDomainError('RESOURCE_NOT_FOUND', 'Child profile was not found.');
    }

    if (
      !/^\d+$/.test(pin) ||
      pin.length < this.pinPolicy.minLength ||
      pin.length > this.pinPolicy.maxLength
    ) {
      throw new IdentityDomainError('VALIDATION_FAILED', 'PIN format is invalid.');
    }

    const pinHash = await this.pinHasher.hash(pin);
    await this.repository.setPinCredential({
      familyId: guardian.familyId,
      childId,
      pinHash,
    });
  }

  async resetChildPin(actor: ActorContext, childId: ChildId, pin: string, now = new Date()) {
    await this.setChildPin(actor, childId, pin);
    const guardian = requireGuardian(actor);
    await this.repository.revokeChildSessionsForChild(guardian.familyId, childId, now);
  }

  async revokeDevice(actor: ActorContext, deviceId: DeviceId, now = new Date()) {
    const guardian = requireGuardian(actor);
    const revoked = await this.repository.revokeDevice(guardian.familyId, deviceId, now);

    if (!revoked) {
      throw new IdentityDomainError('RESOURCE_NOT_FOUND', 'Household device was not found.');
    }
  }
}
