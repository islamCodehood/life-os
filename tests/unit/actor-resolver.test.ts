import { describe, expect, it } from 'vitest';
import type {
  GuardianAuthGateway,
  GuardianIdentity,
  SignInInput,
} from '@/src/application/auth/guardian-auth-gateway';
import { HmacOpaqueTokenService } from '@/src/infrastructure/auth/hmac-opaque-token-service';
import { ServerActorResolver } from '@/src/infrastructure/auth/server-actor-resolver';
import { encodeParentUnlock } from '@/src/infrastructure/auth/parent-unlock-codec';
import type {
  ChildId,
  ChildSessionId,
  DeviceId,
  FamilyId,
  GuardianId,
} from '@/src/domain/shared/id';
import { InMemoryIdentityRepository } from '../support/in-memory-identity-repository';

class FakeGuardianAuth implements GuardianAuthGateway {
  constructor(private readonly identity: GuardianIdentity | null) {}
  async getCurrentGuardian() {
    return this.identity;
  }
  async beginSignIn(input: SignInInput) {
    void input;
  }
  async signOut() {}
  async refreshSession() {}
}

function setup() {
  const repository = new InMemoryIdentityRepository();
  const familyId = '01900000-0000-7000-8000-000000000040' as FamilyId;
  const guardianId = '01900000-0000-7000-8000-000000000041' as GuardianId;
  const childId = '01900000-0000-7000-8000-000000000042' as ChildId;
  const deviceId = '01900000-0000-7000-8000-000000000043' as DeviceId;
  const sessionId = '01900000-0000-7000-8000-000000000044' as ChildSessionId;
  const secret = 'a sufficiently long test secret';
  const tokens = new HmacOpaqueTokenService(secret);

  repository.guardians.set(guardianId, {
    id: guardianId,
    providerUserId: '01900000-0000-7000-8000-000000000045',
    displayName: 'Parent',
  });
  repository.memberships.push({ familyId, guardianId, role: 'OWNER' });
  repository.devices.set(deviceId, {
    id: deviceId,
    familyId,
    label: 'Tablet',
    tokenHash: tokens.hash('device-token', 'device'),
    revokedAt: null,
  });
  repository.sessions.set(sessionId, {
    id: sessionId,
    familyId,
    childId,
    deviceId,
    tokenHash: tokens.hash('child-token', 'child-session'),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
  });

  const identity: GuardianIdentity = {
    providerUserId: '01900000-0000-7000-8000-000000000045',
    email: 'parent@example.com',
    displayName: 'Parent',
  };

  return {
    repository,
    familyId,
    guardianId,
    childId,
    secret,
    tokens,
    auth: new FakeGuardianAuth(identity),
  };
}

describe('ActorResolver precedence', () => {
  it('keeps the child actor active even when a guardian session also exists', async () => {
    const fixture = setup();
    const resolver = new ServerActorResolver(
      fixture.repository,
      fixture.auth,
      fixture.tokens,
      fixture.secret,
    );
    const request = new Request('https://life-os.test/en', {
      headers: { cookie: 'lifeos_child_session=child-token' },
    });

    await expect(resolver.resolve(request)).resolves.toMatchObject({
      kind: 'CHILD',
      childId: fixture.childId,
    });
  });

  it('uses an explicit valid parent unlock before the active child session', async () => {
    const fixture = setup();
    const resolver = new ServerActorResolver(
      fixture.repository,
      fixture.auth,
      fixture.tokens,
      fixture.secret,
    );
    const unlock = encodeParentUnlock(
      {
        familyId: fixture.familyId,
        guardianId: fixture.guardianId,
        expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 60,
      },
      fixture.secret,
    );
    const request = new Request('https://life-os.test/en', {
      headers: {
        cookie: `lifeos_child_session=child-token; lifeos_parent_unlock=${unlock}`,
      },
    });

    await expect(resolver.resolve(request)).resolves.toMatchObject({
      kind: 'GUARDIAN',
      guardianId: fixture.guardianId,
    });
  });
});
