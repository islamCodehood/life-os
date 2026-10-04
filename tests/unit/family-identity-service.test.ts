import { describe, expect, it } from 'vitest';
import type { ActorContext } from '@/src/application/auth/actor-context';
import type { OpaqueTokenService } from '@/src/application/auth/opaque-token-service';
import type { PinHasher } from '@/src/application/auth/pin-hasher';
import { FamilyIdentityService } from '@/src/application/identity/family-identity-service';
import type { FamilyId, GuardianId } from '@/src/domain/shared/id';
import { InMemoryIdentityRepository } from '../support/in-memory-identity-repository';

class FakePinHasher implements PinHasher {
  async hash(pin: string) {
    return `hash:${pin}`;
  }
  async verify(hash: string, pin: string) {
    return hash === `hash:${pin}`;
  }
}

class FakeTokens implements OpaqueTokenService {
  issue(purpose: 'device' | 'child-session') {
    return { rawToken: `raw-${purpose}`, tokenHash: `hash-${purpose}` };
  }
  issueDeterministic(purpose: 'device' | 'child-session', seed: string) {
    return {
      rawToken: `deterministic-${purpose}-${seed}`,
      tokenHash: `${purpose}:deterministic-${seed}`,
    };
  }
  hash(rawToken: string, purpose: 'device' | 'child-session') {
    return `${purpose}:${rawToken}`;
  }
}

describe('FamilyIdentityService', () => {
  it('creates a child with age-recommended presentation defaults', async () => {
    const repository = new InMemoryIdentityRepository();
    const familyId = '01900000-0000-7000-8000-000000000010' as FamilyId;
    const guardianId = '01900000-0000-7000-8000-000000000011' as GuardianId;
    repository.families.set(familyId, {
      id: familyId,
      name: 'Family',
      timezone: 'Africa/Cairo',
      currency: 'EGP',
      weeklyReviewDay: null,
      version: 1,
    });

    const service = new FamilyIdentityService(repository, new FakePinHasher(), new FakeTokens(), {
      minLength: 4,
      maxLength: 8,
    });
    const actor: ActorContext = { kind: 'GUARDIAN', familyId, guardianId };

    const result = await service.createChild(actor, {
      displayName: 'Malika',
      birthDate: '2015-10-04',
      asOfDate: '2026-10-04',
    });

    expect(result.ageProfile).toBe('BUILDER');
    expect(result.experience.visualization).toBe('BALANCED');

    await service.updateExperiencePreference(actor, result.child.id, {
      visualization: 'FOCUSED',
      motion: 'REDUCED',
      themeKey: 'island',
    });

    expect(repository.preferences.get(result.child.id)?.visualization).toBe('FOCUSED');
    expect(result.ageProfile).toBe('BUILDER');
  });

  it('never allows a child actor to administer PINs', async () => {
    const repository = new InMemoryIdentityRepository();
    const service = new FamilyIdentityService(repository, new FakePinHasher(), new FakeTokens(), {
      minLength: 4,
      maxLength: 8,
    });

    const childActor: ActorContext = {
      kind: 'CHILD',
      familyId: '01900000-0000-7000-8000-000000000010' as FamilyId,
      childId: '01900000-0000-7000-8000-000000000012' as never,
      deviceId: '01900000-0000-7000-8000-000000000013' as never,
    };

    await expect(
      service.setChildPin(actorOrNever(childActor), childActor.childId, '1234'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

function actorOrNever(actor: ActorContext): ActorContext {
  return actor;
}
