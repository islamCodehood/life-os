import { NextResponse } from 'next/server';
import { FamilyIdentityService } from '@/src/application/identity/family-identity-service';
import { createFamilyCommandSchema } from '@/src/application/identity/e1-command-schema';
import type { ActorContext } from '@/src/application/auth/actor-context';
import type { FamilyId } from '@/src/domain/shared/id';
import { Argon2PinHasher } from '@/src/infrastructure/auth/argon2-pin-hasher';
import { authCookieNames } from '@/src/infrastructure/auth/cookies';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { executeIdempotentCommand } from '@/src/infrastructure/commands/idempotent-command';
import { PostgresIdentityRepository } from '@/src/infrastructure/identity/postgres-identity-repository';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

type FamilyCommandResponse = {
  commandId: string;
  status: 'ACCEPTED';
  serverTime: string;
  data: { family: { id: FamilyId; name: string; timezone: string; currency: string } };
  effects: never[];
};

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const command = createFamilyCommandSchema.parse(await request.json());
    const runtime = await createIdentityRuntime();
    const identity = await runtime.guardianAuth.getCurrentGuardian();

    if (!identity) throw new AppError('AUTH_REQUIRED', 'Guardian authentication is required.');

    const bootstrapActor: ActorContext = {
      kind: 'SYSTEM',
    };

    const result = await executeIdempotentCommand<FamilyCommandResponse>({
      commandId: command.commandId,
      command,
      actor: bootstrapActor,
      execute: async (db) => {
        const repository = new PostgresIdentityRepository(db);
        const familyIdentity = new FamilyIdentityService(
          repository,
          new Argon2PinHasher(),
          runtime.tokens,
          {
            minLength: runtime.env.PIN_MIN_LENGTH,
            maxLength: runtime.env.PIN_MAX_LENGTH,
          },
        );
        const created = await familyIdentity.createFamily(identity, command.payload);
        return {
          response: {
            commandId: command.commandId,
            status: 'ACCEPTED' as const,
            serverTime: new Date().toISOString(),
            data: {
              family: {
                id: created.family.id,
                name: created.family.name,
                timezone: created.family.timezone,
                currency: created.family.currency,
              },
            },
            effects: [],
          },
        };
      },
    });

    const response = NextResponse.json(result.response, {
      status: result.replayed ? 200 : 201,
      headers: {
        'x-request-id': requestId,
        'cache-control': 'no-store',
        'x-life-os-command-replayed': result.replayed ? '1' : '0',
      },
    });

    response.cookies.set(authCookieNames.family, result.response.data.family.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
