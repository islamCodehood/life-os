import type { PinHasher } from '@/src/application/auth/pin-hasher';
import { newId } from '@/src/domain/shared/id';
import type { ChildId, ChildSessionId, DeviceId } from '@/src/domain/shared/id';
import { createOpaqueToken, hashOpaqueToken } from '@/src/infrastructure/auth/token-crypto';
import type { IdentityRepository } from './identity-repository';
import { IdentityDomainError } from './family-identity-service';

export interface SessionSecurityConfig {
  hashSecret: string;
  childSessionTtlSeconds: number;
  maxPinAttempts: number;
  pinLockoutSeconds: number;
}

export class ChildSessionService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly pinHasher: PinHasher,
    private readonly config: SessionSecurityConfig,
  ) {}

  async createSession(input: {
    childId: ChildId;
    deviceId: DeviceId;
    deviceToken: string;
    pin: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const deviceHash = hashOpaqueToken(input.deviceToken, this.config.hashSecret, 'device');
    const device = await this.repository.findTrustedDeviceByTokenHash(deviceHash);

    if (!device || device.id !== input.deviceId || device.revokedAt) {
      throw new IdentityDomainError('FORBIDDEN', 'This household device is not trusted.');
    }

    const child = await this.repository.getChild(device.familyId, input.childId);
    if (!child || child.status !== 'ACTIVE') {
      throw new IdentityDomainError('RESOURCE_NOT_FOUND', 'Child profile was not found.');
    }

    const credential = await this.repository.getPinCredential(device.familyId, input.childId);
    if (!credential) {
      throw new IdentityDomainError('FORBIDDEN', 'Child PIN is not configured.');
    }

    if (credential.lockedUntil && credential.lockedUntil > now) {
      throw new IdentityDomainError('FORBIDDEN', 'PIN entry is temporarily locked.');
    }

    const valid = await this.pinHasher.verify(credential.pinHash, input.pin);
    if (!valid) {
      await this.repository.recordPinFailure({
        familyId: device.familyId,
        childId: input.childId,
        maxAttempts: this.config.maxPinAttempts,
        lockedUntil: new Date(now.getTime() + this.config.pinLockoutSeconds * 1000),
      });
      throw new IdentityDomainError('FORBIDDEN', 'PIN is incorrect.');
    }

    await this.repository.clearPinFailures(device.familyId, input.childId);

    const rawToken = createOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken, this.config.hashSecret, 'child-session');
    const expiresAt = new Date(now.getTime() + this.config.childSessionTtlSeconds * 1000);
    const session = await this.repository.createChildSession({
      sessionId: newId<'ChildSessionId'>() as ChildSessionId,
      familyId: device.familyId,
      childId: input.childId,
      deviceId: input.deviceId,
      tokenHash,
      expiresAt,
    });

    return { rawToken, session };
  }

  async revokeSessionByToken(rawToken: string, now = new Date()) {
    const tokenHash = hashOpaqueToken(rawToken, this.config.hashSecret, 'child-session');
    const session = await this.repository.findActiveChildSessionByTokenHash(tokenHash, now);
    if (!session) return false;
    return this.repository.revokeChildSession(session.familyId, session.id, now);
  }
}
