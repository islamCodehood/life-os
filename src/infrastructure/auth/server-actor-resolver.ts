import type { ActorContext } from '@/src/application/auth/actor-context';
import type { ActorResolver } from '@/src/application/auth/actor-resolver';
import type { GuardianAuthGateway } from '@/src/application/auth/guardian-auth-gateway';
import type { OpaqueTokenService } from '@/src/application/auth/opaque-token-service';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import type { FamilyId } from '@/src/domain/shared/id';
import { authCookieNames, parseCookieHeader } from './cookies';
import { decodeParentUnlock } from './parent-unlock-codec';

export class ServerActorResolver implements ActorResolver {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly guardianAuth: GuardianAuthGateway,
    private readonly tokens: OpaqueTokenService,
    private readonly signingSecret: string,
  ) {}

  async resolve(request: Request): Promise<ActorContext | null> {
    const cookieMap = parseCookieHeader(request.headers.get('cookie'));
    const parentUnlock = cookieMap.get(authCookieNames.parentUnlock);

    if (parentUnlock) {
      const guardianActor = await this.resolveParentUnlock(parentUnlock);
      if (guardianActor) return guardianActor;
    }

    const childToken = cookieMap.get(authCookieNames.childSession);
    if (childToken) {
      const childActor = await this.resolveChild(childToken);
      if (childActor) return childActor;
    }

    return this.resolveGuardian(cookieMap.get(authCookieNames.family));
  }

  private async resolveParentUnlock(rawUnlock: string): Promise<ActorContext | null> {
    const payload = decodeParentUnlock(rawUnlock, this.signingSecret);
    if (!payload) return null;

    const identity = await this.guardianAuth.getCurrentGuardian();
    if (!identity) return null;

    const guardian = await this.repository.findGuardianByProviderUserId(identity.providerUserId);
    if (!guardian || guardian.id !== payload.guardianId) return null;

    const memberships = await this.repository.listGuardianMemberships(guardian.id);
    if (!memberships.some((membership) => membership.familyId === payload.familyId)) return null;

    return {
      kind: 'GUARDIAN',
      familyId: payload.familyId,
      guardianId: guardian.id,
    };
  }

  private async resolveChild(rawToken: string): Promise<ActorContext | null> {
    const tokenHash = this.tokens.hash(rawToken, 'child-session');
    const session = await this.repository.findActiveChildSessionByTokenHash(tokenHash, new Date());
    if (!session) return null;

    return {
      kind: 'CHILD',
      familyId: session.familyId,
      childId: session.childId,
      deviceId: session.deviceId,
    };
  }

  private async resolveGuardian(rawFamilyId?: string): Promise<ActorContext | null> {
    const identity = await this.guardianAuth.getCurrentGuardian();
    if (!identity) return null;

    const guardian = await this.repository.findGuardianByProviderUserId(identity.providerUserId);
    if (!guardian) return null;

    const memberships = await this.repository.listGuardianMemberships(guardian.id);
    if (memberships.length === 0) return null;

    const selected = rawFamilyId
      ? memberships.find((membership) => membership.familyId === rawFamilyId)
      : memberships.length === 1
        ? memberships[0]
        : undefined;

    if (!selected) return null;

    return {
      kind: 'GUARDIAN',
      familyId: selected.familyId as FamilyId,
      guardianId: selected.guardianId,
    };
  }
}
