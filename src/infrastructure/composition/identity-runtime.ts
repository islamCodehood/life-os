import { Argon2PinHasher } from '@/src/infrastructure/auth/argon2-pin-hasher';
import { createGuardianAuthGateway } from '@/src/infrastructure/auth/supabase-guardian-auth-gateway';
import { HmacOpaqueTokenService } from '@/src/infrastructure/auth/hmac-opaque-token-service';
import { ServerActorResolver } from '@/src/infrastructure/auth/server-actor-resolver';
import { getDatabase } from '@/src/infrastructure/database/client';
import { getServerEnv } from '@/src/infrastructure/env/server';
import { PostgresIdentityRepository } from '@/src/infrastructure/identity/postgres-identity-repository';
import { FamilyIdentityService } from '@/src/application/identity/family-identity-service';
import { ChildSessionService } from '@/src/application/identity/child-session-service';
import { AuthorizationService } from '@/src/application/identity/authorization-service';

export async function createIdentityRuntime() {
  const env = getServerEnv();
  if (!env.CHILD_SESSION_HASH_SECRET) {
    throw new Error('CHILD_SESSION_HASH_SECRET is required for E1 identity/session operations.');
  }

  const repository = new PostgresIdentityRepository(getDatabase().db);
  const guardianAuth = await createGuardianAuthGateway();
  const pinHasher = new Argon2PinHasher();
  const tokens = new HmacOpaqueTokenService(env.CHILD_SESSION_HASH_SECRET);

  const familyIdentity = new FamilyIdentityService(repository, pinHasher, tokens, {
    minLength: env.PIN_MIN_LENGTH,
    maxLength: env.PIN_MAX_LENGTH,
  });

  const childSessions = new ChildSessionService(repository, pinHasher, tokens, {
    childSessionTtlSeconds: env.CHILD_SESSION_TTL_SECONDS,
    maxPinAttempts: env.PIN_MAX_ATTEMPTS,
    pinLockoutSeconds: env.PIN_LOCKOUT_SECONDS,
  });

  const actorResolver = new ServerActorResolver(
    repository,
    guardianAuth,
    tokens,
    env.CHILD_SESSION_HASH_SECRET,
  );

  return {
    env,
    repository,
    guardianAuth,
    familyIdentity,
    childSessions,
    actorResolver,
    authorization: new AuthorizationService(repository),
    tokens,
  };
}
