import { describe, expect, it } from 'vitest';
import type { OpaqueTokenService } from '@/src/application/auth/opaque-token-service';
import type { PinHasher } from '@/src/application/auth/pin-hasher';
import { ChildSessionService } from '@/src/application/identity/child-session-service';
import type { ChildId, DeviceId, FamilyId } from '@/src/domain/shared/id';
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
    return { rawToken: `raw-${purpose}`, tokenHash: `${purpose}:issued` };
  }
  hash(rawToken: string, purpose: 'device' | 'child-session') {
    return `${purpose}:${rawToken}`;
  }
}

function fixture() {
  const repository = new InMemoryIdentityRepository();
  const familyId = '01900000-0000-7000-8000-000000000020' as FamilyId;
  const childId = '01900000-0000-7000-8000-000000000021' as ChildId;
  const deviceId = '01900000-0000-7000-8000-000000000022' as DeviceId;

  repository.families.set(familyId, {
    id: familyId,
    name: 'Family',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
    weeklyReviewDay: null,
    version: 1,
  });
  repository.children.set(childId, {
    id: childId,
    familyId,
    displayName: 'Eyad',
    birthDate: '2019-01-01',
    avatarKey: null,
    status: 'ACTIVE',
    version: 1,
  });
  repository.devices.set(deviceId, {
    id: deviceId,
    familyId,
    label: 'Tablet',
    tokenHash: 'device:device-secret',
    revokedAt: null,
  });
  repository.pins.set(childId, {
    familyId,
    childId,
    pinHash: 'hash:1234',
    failedAttempts: 0,
    lockedUntil: null,
    version: 1,
  });

  const service = new ChildSessionService(
    repository,
    new FakePinHasher(),
    new FakeTokens(),
    { childSessionTtlSeconds: 3600, maxPinAttempts: 2, pinLockoutSeconds: 60 },
  );

  return { repository, service, familyId, childId, deviceId };
}

describe('ChildSessionService', () => {
  it('creates a child-scoped session only on the trusted device', async () => {
    const { service, childId, deviceId } = fixture();

    const result = await service.createSession({
      childId,
      deviceId,
      deviceToken: 'device-secret',
      pin: '1234',
      now: new Date('2026-10-04T12:00:00Z'),
    });

    expect(result.rawToken).toBe('raw-child-session');
    expect(result.session.childId).toBe(childId);
    expect(result.session.deviceId).toBe(deviceId);
  });

  it('denies a revoked device', async () => {
    const { repository, service, familyId, childId, deviceId } = fixture();
    await repository.revokeDevice(familyId, deviceId, new Date('2026-10-04T11:00:00Z'));

    await expect(
      service.createSession({
        childId,
        deviceId,
        deviceToken: 'device-secret',
        pin: '1234',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('locks PIN entry after configured repeated failures', async () => {
    const { service, childId, deviceId } = fixture();
    const input = {
      childId,
      deviceId,
      deviceToken: 'device-secret',
      pin: '9999',
      now: new Date('2026-10-04T12:00:00Z'),
    };

    await expect(service.createSession(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.createSession(input)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});
