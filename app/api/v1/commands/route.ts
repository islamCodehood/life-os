import { NextResponse } from 'next/server';
import { e1CommandSchema } from '@/src/application/identity/e1-command-schema';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import type { ChildId, DeviceId } from '@/src/domain/shared/id';
import { authCookieNames } from '@/src/infrastructure/auth/cookies';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

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

    let data: unknown = null;
    let deviceToken: string | undefined;

    switch (command.type) {
      case 'CreateChildProfile': {
        const family = await runtime.repository.getFamily(actor.familyId);
        if (!family) throw new AppError('RESOURCE_NOT_FOUND', 'Family was not found.');
        data = await runtime.familyIdentity.createChild(actor, {
          ...command.payload,
          asOfDate: currentDateInTimezone(family.timezone),
        });
        break;
      }
      case 'UpdateExperiencePreferences':
        await runtime.familyIdentity.updateExperiencePreference(
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
        const result = await runtime.familyIdentity.registerDevice(actor, command.payload.label);
        data = { device: result.device };
        deviceToken = result.rawToken;
        break;
      }
      case 'RevokeHouseholdDevice':
        await runtime.familyIdentity.revokeDevice(
          actor,
          command.payload.deviceId as DeviceId,
        );
        break;
      case 'SetChildPin':
        await runtime.familyIdentity.setChildPin(
          actor,
          command.payload.childId as ChildId,
          command.payload.pin,
        );
        break;
      case 'ResetChildPin':
        await runtime.familyIdentity.resetChildPin(
          actor,
          command.payload.childId as ChildId,
          command.payload.pin,
        );
        break;
    }

    const response = NextResponse.json(
      {
        commandId: command.commandId,
        status: 'ACCEPTED',
        serverTime: new Date().toISOString(),
        data,
        effects: [],
      },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );

    if (deviceToken) {
      response.cookies.set(authCookieNames.householdDevice, deviceToken, {
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
