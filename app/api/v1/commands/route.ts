import { NextResponse } from 'next/server';
import { Argon2PinHasher } from '@/src/infrastructure/auth/argon2-pin-hasher';
import { e1CommandSchema } from '@/src/application/identity/e1-command-schema';
import { FamilyIdentityService } from '@/src/application/identity/family-identity-service';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import type { ChildId, DeviceId } from '@/src/domain/shared/id';
import { authCookieNames } from '@/src/infrastructure/auth/cookies';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { executeIdempotentCommand } from '@/src/infrastructure/commands/idempotent-command';
import { PostgresIdentityRepository } from '@/src/infrastructure/identity/postgres-identity-repository';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

type CommandResponse = {
  commandId: string;
  status: 'ACCEPTED';
  serverTime: string;
  data: unknown;
  effects: never[];
};

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const command = e1CommandSchema.parse(await request.json());
    const runtime = await createIdentityRuntime();
    const actor = await runtime.actorResolver.resolve(request);

    if (!actor) throw new AppError('AUTH_REQUIRED', 'Authentication is required.');
    if (actor.kind !== 'GUARDIAN') {
      throw new AppError('FORBIDDEN', 'Guardian permission is required.');
    }

    const result = await executeIdempotentCommand<CommandResponse, { deviceToken?: string }>({
      commandId: command.commandId,
      command,
      actor,
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

        let data: unknown = null;
        let deviceToken: string | undefined;

        switch (command.type) {
          case 'CreateChildProfile': {
            const family = await repository.getFamily(actor.familyId);
            if (!family) throw new AppError('RESOURCE_NOT_FOUND', 'Family was not found.');
            data = await familyIdentity.createChild(actor, {
              displayName: command.payload.displayName,
              birthDate: command.payload.birthDate,
              asOfDate: currentDateInTimezone(family.timezone),
              ...(command.payload.avatarKey === undefined
                ? {}
                : { avatarKey: command.payload.avatarKey }),
            });
            break;
          }
          case 'UpdateExperiencePreferences':
            await familyIdentity.updateExperiencePreference(
              actor,
              command.payload.childId as ChildId,
              {
                visualization: command.payload.visualization,
                motion: command.payload.motion,
                themeKey: command.payload.themeKey,
              },
            );
            break;
          case 'RegisterHouseholdDevice': {
            const enrolled = await familyIdentity.registerDevice(actor, command.payload.label);
            data = { device: enrolled.device };
            deviceToken = enrolled.rawToken;
            break;
          }
          case 'RevokeHouseholdDevice':
            await familyIdentity.revokeDevice(actor, command.payload.deviceId as DeviceId);
            break;
          case 'SetChildPin':
            await familyIdentity.setChildPin(
              actor,
              command.payload.childId as ChildId,
              command.payload.pin,
            );
            break;
          case 'ResetChildPin':
            await familyIdentity.resetChildPin(
              actor,
              command.payload.childId as ChildId,
              command.payload.pin,
            );
            break;
        }

        return {
          response: {
            commandId: command.commandId,
            status: 'ACCEPTED' as const,
            serverTime: new Date().toISOString(),
            data,
            effects: [],
          },
          ...(deviceToken === undefined ? {} : { transient: { deviceToken } }),
        };
      },
    });

    const response = NextResponse.json(result.response, {
      headers: {
        'x-request-id': requestId,
        'cache-control': 'no-store',
        'x-life-os-command-replayed': result.replayed ? '1' : '0',
      },
    });

    if (result.transient?.deviceToken) {
      response.cookies.set(authCookieNames.householdDevice, result.transient.deviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
