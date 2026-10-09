import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ActivityService } from '@/src/application/activity/activity-service';
import { e2CommandSchema } from '@/src/application/activity/e2-command-schema';
import { e4CommandSchema } from '@/src/application/activity/e4-command-schema';
import { AuthorizationService } from '@/src/application/identity/authorization-service';
import { Argon2PinHasher } from '@/src/infrastructure/auth/argon2-pin-hasher';
import { e1CommandSchema } from '@/src/application/identity/e1-command-schema';
import { FamilyIdentityService } from '@/src/application/identity/family-identity-service';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import type { ActivityInstanceId, ChildId, DeviceId } from '@/src/domain/shared/id';
import { PostgresActivityRepository } from '@/src/infrastructure/activity/postgres-activity-repository';
import { authCookieNames } from '@/src/infrastructure/auth/cookies';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { executeIdempotentCommand } from '@/src/infrastructure/commands/idempotent-command';
import { PostgresIdentityRepository } from '@/src/infrastructure/identity/postgres-identity-repository';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

const commandSchema = z.union([e1CommandSchema, e2CommandSchema, e4CommandSchema]);

type CommandResponse = {
  commandId: string;
  status: 'ACCEPTED';
  serverTime: string;
  data: unknown;
  resourceVersions?: Array<{
    resourceType: string;
    resourceId: string;
    version: number;
  }>;
  effects: Array<{ type: string }>;
};

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const command = commandSchema.parse(await request.json());
    const runtime = await createIdentityRuntime();
    const actor = await runtime.actorResolver.resolve(request);

    if (!actor) throw new AppError('AUTH_REQUIRED', 'Authentication is required.');
    if (actor.kind === 'SYSTEM') {
      throw new AppError('FORBIDDEN', 'A family actor is required.');
    }

    const result = await executeIdempotentCommand<CommandResponse, { deviceToken?: string }>({
      commandId: command.commandId,
      command,
      actor,
      execute: async (db) => {
        const identityRepository = new PostgresIdentityRepository(db);
        const familyIdentity = new FamilyIdentityService(
          identityRepository,
          new Argon2PinHasher(),
          runtime.tokens,
          {
            minLength: runtime.env.PIN_MIN_LENGTH,
            maxLength: runtime.env.PIN_MAX_LENGTH,
          },
        );
        const activityRepository = new PostgresActivityRepository(db);
        const activities = new ActivityService(
          activityRepository,
          identityRepository,
          new AuthorizationService(identityRepository),
        );

        let data: unknown = null;
        let resourceVersions: CommandResponse['resourceVersions'];
        let deviceToken: string | undefined;
        const serverNow = new Date();

        switch (command.type) {
          case 'CreateChildProfile': {
            const family = await identityRepository.getFamily(actor.familyId);
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
            const enrolled = await familyIdentity.registerDevice(
              actor,
              command.payload.label,
              command.commandId,
            );
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
          case 'AssignMakeBed': {
            const assigned = await activities.assignMakeBed(
              actor,
              command.payload.childId as ChildId,
              serverNow,
            );
            data = {
              assignmentId: assigned.assignment.id,
              instanceId: assigned.instance.id,
              created: assigned.created,
            };
            resourceVersions = [
              {
                resourceType: 'ActivityAssignment',
                resourceId: assigned.assignment.id,
                version: assigned.assignment.version,
              },
              {
                resourceType: 'ActivityInstance',
                resourceId: assigned.instance.id,
                version: assigned.instance.version,
              },
            ];
            break;
          }
          case 'CompleteActivity': {
            const expectedVersion = command.expectedVersions?.find(
              (entry) =>
                entry.resourceType === 'ActivityInstance' &&
                entry.resourceId === command.payload.activityInstanceId,
            )?.version;
            const completed = await activities.completeActivity({
              actor,
              instanceId: command.payload.activityInstanceId as ActivityInstanceId,
              occurredAt: new Date(command.occurredAt),
              recordedAt: serverNow,
              ...(expectedVersion === undefined ? {} : { expectedVersion }),
            });
            data = {
              activityInstanceId: completed.instance.id,
              completionId: completed.completion.id,
              alreadyCompleted: completed.alreadyCompleted,
            };
            resourceVersions = [
              {
                resourceType: 'ActivityInstance',
                resourceId: completed.instance.id,
                version: completed.instance.version,
              },
            ];
            break;
          }
          case 'MarkActivityMissed': {
            const expectedVersion = command.expectedVersions?.find(
              (entry) =>
                entry.resourceType === 'ActivityInstance' &&
                entry.resourceId === command.payload.activityInstanceId,
            )?.version;
            const updated = await activities.markActivityMissed({
              actor,
              instanceId: command.payload.activityInstanceId as ActivityInstanceId,
              occurredAt: new Date(command.occurredAt),
              recordedAt: serverNow,
              ...(expectedVersion === undefined ? {} : { expectedVersion }),
            });
            data = { activityInstanceId: updated.id, status: updated.status };
            resourceVersions = [
              {
                resourceType: 'ActivityInstance',
                resourceId: updated.id,
                version: updated.version,
              },
            ];
            break;
          }
          case 'ExcuseActivity': {
            const expectedVersion = command.expectedVersions?.find(
              (entry) =>
                entry.resourceType === 'ActivityInstance' &&
                entry.resourceId === command.payload.activityInstanceId,
            )?.version;
            const updated = await activities.excuseActivity({
              actor,
              instanceId: command.payload.activityInstanceId as ActivityInstanceId,
              occurredAt: new Date(command.occurredAt),
              recordedAt: serverNow,
              ...(expectedVersion === undefined ? {} : { expectedVersion }),
            });
            data = { activityInstanceId: updated.id, status: updated.status };
            resourceVersions = [
              {
                resourceType: 'ActivityInstance',
                resourceId: updated.id,
                version: updated.version,
              },
            ];
            break;
          }
        }

        return {
          response: {
            commandId: command.commandId,
            status: 'ACCEPTED' as const,
            serverTime: serverNow.toISOString(),
            data,
            ...(resourceVersions === undefined ? {} : { resourceVersions }),
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

    const deviceToken =
      result.transient?.deviceToken ??
      (command.type === 'RegisterHouseholdDevice'
        ? runtime.tokens.issueDeterministic('device', command.commandId).rawToken
        : undefined);

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
