import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ActivityService } from '@/src/application/activity/activity-service';
import { e2CommandSchema } from '@/src/application/activity/e2-command-schema';
import { e4CommandSchema } from '@/src/application/activity/e4-command-schema';
import { e5CommandSchema } from '@/src/application/graduation/e5-command-schema';
import { e6CommandSchema } from '@/src/application/growth/e6-command-schema';
import { e7CommandSchema } from '@/src/application/goals/e7-command-schema';
import { e8CommandSchema } from '@/src/application/money/e8-command-schema';
import { MoneyService } from '@/src/application/money/money-service';
import { JobService } from '@/src/application/jobs/job-service';
import { PostgresMoneyRepository } from '@/src/infrastructure/money/postgres-money-repository';
import { PostgresJobRepository } from '@/src/infrastructure/jobs/postgres-job-repository';
import { GoalService } from '@/src/application/goals/goal-service';
import { PostgresGoalRepository } from '@/src/infrastructure/goals/postgres-goal-repository';
import { PostgresXpRepository } from '@/src/infrastructure/growth/postgres-xp-repository';
import { GraduationService } from '@/src/application/graduation/graduation-service';
import { PostgresGraduationRepository } from '@/src/infrastructure/graduation/postgres-graduation-repository';
import { AuthorizationService } from '@/src/application/identity/authorization-service';
import { Argon2PinHasher } from '@/src/infrastructure/auth/argon2-pin-hasher';
import { e1CommandSchema } from '@/src/application/identity/e1-command-schema';
import { FamilyIdentityService } from '@/src/application/identity/family-identity-service';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import type {
  ActivityAssignmentId,
  ActivityInstanceId,
  ChildId,
  DeviceId,
} from '@/src/domain/shared/id';
import { PostgresActivityRepository } from '@/src/infrastructure/activity/postgres-activity-repository';
import { authCookieNames } from '@/src/infrastructure/auth/cookies';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { executeIdempotentCommand } from '@/src/infrastructure/commands/idempotent-command';
import { PostgresIdentityRepository } from '@/src/infrastructure/identity/postgres-identity-repository';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

const commandSchema = z.union([
  e1CommandSchema,
  e2CommandSchema,
  e4CommandSchema,
  e5CommandSchema,
  e6CommandSchema,
  e7CommandSchema,
  e8CommandSchema,
]);

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
          new PostgresXpRepository(db),
        );

        const goals = new GoalService(
          new PostgresGoalRepository(db),
          identityRepository,
          activityRepository,
        );
        const money = new MoneyService(new PostgresMoneyRepository(db), identityRepository);
        const jobs = new JobService(new PostgresJobRepository(db), identityRepository, money);
        const graduations = new GraduationService(
          new PostgresGraduationRepository(db),
          activityRepository,
          identityRepository,
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
              instanceId: assigned.instance?.id ?? null,
              created: assigned.created,
            };
            resourceVersions = [
              {
                resourceType: 'ActivityAssignment',
                resourceId: assigned.assignment.id,
                version: assigned.assignment.version,
              },
              ...(assigned.instance
                ? [
                    {
                      resourceType: 'ActivityInstance',
                      resourceId: assigned.instance.id,
                      version: assigned.instance.version,
                    },
                  ]
                : []),
            ];
            break;
          }
          case 'AssignGrowthPractice': {
            const assigned = await activities.assignGrowthPractice(
              actor,
              command.payload.childId as ChildId,
              command.payload.templateKey,
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
          case 'CorrectXpGrant': {
            data = await activities.correctXpGrant({
              actor,
              xpEntryId: command.payload.xpEntryId,
              reason: command.payload.reason,
              occurredAt: new Date(command.occurredAt),
              recordedAt: serverNow,
            });
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
              xpAward: completed.alreadyCompleted ? null : completed.xpAward,
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
          case 'CreateGoal': {
            const goal = await goals.create(actor, {
              ...command.payload,
              occurredAt: new Date(command.occurredAt),
              now: serverNow,
            });
            data = { goalId: goal.id, status: goal.status, version: goal.version };
            resourceVersions = [
              { resourceType: 'Goal', resourceId: goal.id, version: goal.version },
            ];
            break;
          }
          case 'ApproveGoal':
          case 'PauseGoal':
          case 'ResumeGoal':
          case 'AchieveGoal':
          case 'CloseGoal': {
            const status =
              command.type === 'ApproveGoal' || command.type === 'ResumeGoal'
                ? 'ACTIVE'
                : command.type === 'PauseGoal'
                  ? 'PAUSED'
                  : command.type === 'AchieveGoal'
                    ? 'ACHIEVED'
                    : 'CLOSED';
            const updated = await goals.transition(actor, {
              id: command.payload.goalId,
              to: status,
              expectedVersion: command.expectedVersions?.find(
                (v) => v.resourceType === 'Goal' && v.resourceId === command.payload.goalId,
              )?.version,
              occurredAt: new Date(command.occurredAt),
              now: serverNow,
            });
            data = { goalId: updated.id, status: updated.status };
            resourceVersions = [
              { resourceType: 'Goal', resourceId: updated.id, version: updated.version },
            ];
            break;
          }
          case 'AddGoalProgress': {
            const result = await goals.addProgress(actor, {
              id: command.payload.goalId,
              amount: command.payload.amount,
              step: command.payload.step,
              expectedVersion: command.expectedVersions?.find(
                (v) => v.resourceType === 'Goal' && v.resourceId === command.payload.goalId,
              )?.version,
              occurredAt: new Date(command.occurredAt),
              now: serverNow,
            });
            data = {
              goalId: result.goal.id,
              progress: result.goal.progress,
              progressEntryId: result.entryId,
            };
            resourceVersions = [
              { resourceType: 'Goal', resourceId: result.goal.id, version: result.goal.version },
            ];
            break;
          }
          case 'ReviseGoal': {
            const updated = await goals.revise(actor, {
              id: command.payload.goalId,
              target: command.payload.target,
              targetDate: command.payload.targetDate,
              reason: command.payload.reason,
              expectedVersion: command.expectedVersions?.find(
                (v) => v.resourceType === 'Goal' && v.resourceId === command.payload.goalId,
              )?.version,
              occurredAt: new Date(command.occurredAt),
              now: serverNow,
            });
            data = { goalId: updated.id, target: updated.target, targetDate: updated.targetDate };
            resourceVersions = [
              { resourceType: 'Goal', resourceId: updated.id, version: updated.version },
            ];
            break;
          }
          case 'RecordGoalReflection': {
            data = await goals.reflect(actor, {
              id: command.payload.goalId,
              text: command.payload.text,
              occurredAt: new Date(command.occurredAt),
              now: serverNow,
            });
            break;
          }
          case 'CreateJob': {
            const job = await jobs.create(actor, {...command.payload,now:serverNow});
            data = {jobId:job.id,status:job.status,paymentMinor:job.paymentMinor};
            resourceVersions = [{resourceType:'Job',resourceId:job.id,version:job.version}];
            break;
          }
          case 'ReviseJobTerms': {
            const job = await jobs.revise(actor,{
              ...command.payload,now:serverNow,
              expectedVersion:command.expectedVersions?.find(v=>
                v.resourceType==='Job'&&v.resourceId===command.payload.jobId)?.version,
            });
            data = {jobId:job.id,status:job.status,termsVersion:job.termsVersion};
            resourceVersions = [{resourceType:'Job',resourceId:job.id,version:job.version}];
            break;
          }
          case 'AcceptJob':
          case 'StartJob':
          case 'SubmitJob':
          case 'RequestJobRevision':
          case 'RestartJob':
          case 'ApproveJob':
          case 'CreditApprovedJob':
          case 'CancelJob': {
            const actionMap = {
              AcceptJob:'ACCEPT',StartJob:'START',SubmitJob:'SUBMIT',
              RequestJobRevision:'REQUEST_REVISION',RestartJob:'RESTART',
              ApproveJob:'APPROVE',CreditApprovedJob:'CREDIT',CancelJob:'CANCEL',
            } as const;
            const job = await jobs.action(actor,{
              jobId:command.payload.jobId,action:actionMap[command.type],
              expectedVersion:command.expectedVersions?.find(v=>
                v.resourceType==='Job'&&v.resourceId===command.payload.jobId)?.version,
              occurredAt:new Date(command.occurredAt),now:serverNow,
            });
            data = {jobId:job.id,status:job.status};
            resourceVersions = [{resourceType:'Job',resourceId:job.id,version:job.version}];
            break;
          }
          case 'RecordGiftIncome':
          case 'RecordAllowanceIncome': {
            const tx = await money.recordIncome(actor,{
              ...command.payload,kind:command.type==='RecordGiftIncome'?'GIFT':'ALLOWANCE',
              occurredAt:new Date(command.occurredAt),now:serverNow,
            });
            data = {transactionId:tx.id};
            break;
          }
          case 'AllocateMoney': {
            const tx = await money.allocate(actor,{...command.payload,
              occurredAt:new Date(command.occurredAt),now:serverNow});
            data = {transactionId:tx.id};
            break;
          }
          case 'RecordSpend':
          case 'RecordGiving': {
            const tx = await money.outgoing(actor,{...command.payload,
              kind:command.type==='RecordSpend'?'SPEND':'GIVING',
              occurredAt:new Date(command.occurredAt),now:serverNow});
            data = {transactionId:tx.id};
            break;
          }
          case 'CorrectMoneyTransaction': {
            const tx = await money.correct(actor,{
              ...command.payload,occurredAt:new Date(command.occurredAt),now:serverNow});
            data = {transactionId:tx.id,correctionOf:tx.correctionOf};
            break;
          }
          case 'CreateSavingGoal': {
            const goal = await money.createSavingGoal(actor,command.payload);
            data = {savingGoalId:goal.id,status:goal.status};
            resourceVersions = [{resourceType:'SavingGoal',resourceId:goal.id,version:goal.version}];
            break;
          }
          case 'AllocateToSavingGoal': {
            data = await money.allocateToSavingGoal(actor,command.payload);
            break;
          }
          case 'CloseSavingGoal': {
            data = await money.closeSavingGoal(actor,command.payload.savingGoalId,
              command.expectedVersions?.find(v=>
                v.resourceType==='SavingGoal'&&v.resourceId===command.payload.savingGoalId)?.version);
            break;
          }
          case 'RequestGraduationReview': {
            const review = await graduations.requestReview(
              actor,
              command.payload.assignmentId as ActivityAssignmentId,
              serverNow,
            );
            data = { suggestionId: review.id, status: review.status, origin: review.origin };
            break;
          }
          case 'ApproveGraduation':
          case 'DeclineGraduation':
          case 'SnoozeGraduation': {
            const result = await graduations.decideGraduation({
              actor,
              suggestionId: command.payload.suggestionId,
              decision:
                command.type === 'ApproveGraduation'
                  ? 'APPROVE'
                  : command.type === 'DeclineGraduation'
                    ? 'DECLINE'
                    : 'SNOOZE',
              expectedVersion: command.expectedVersions?.find(
                (entry) => entry.resourceType === 'ActivityAssignment',
              )?.version,
              ...(command.type === 'ApproveGraduation'
                ? {
                    monitoringIntervalDays: command.payload.monitoringIntervalDays,
                  }
                : {}),
              occurredAt: new Date(command.occurredAt),
              now: serverNow,
            });
            data = {
              suggestionId: result.suggestion.id,
              status: result.suggestion.status,
              assignmentStatus: result.assignment.status,
              graduationRecordId: result.graduation?.id ?? null,
            };
            resourceVersions = [
              {
                resourceType: 'ActivityAssignment',
                resourceId: result.assignment.id,
                version: result.assignment.version,
              },
            ];
            break;
          }
          case 'RecordGraduatedObservation': {
            data = await graduations.recordObservation({
              actor,
              graduationRecordId: command.payload.graduationRecordId,
              result: command.payload.result,
              occurredAt: new Date(command.occurredAt),
              now: serverNow,
            });
            break;
          }
          case 'ApproveReactivation':
          case 'DeclineReactivation': {
            const result = await graduations.decideReactivation({
              actor,
              suggestionId: command.payload.suggestionId,
              decision: command.type === 'ApproveReactivation' ? 'APPROVE' : 'DECLINE',
              expectedVersion: command.expectedVersions?.find(
                (entry) => entry.resourceType === 'ActivityAssignment',
              )?.version,
              occurredAt: new Date(command.occurredAt),
              now: serverNow,
            });
            data = {
              suggestionId: result.suggestion.id,
              status: result.suggestion.status,
              assignmentStatus: result.assignment.status,
            };
            resourceVersions = [
              {
                resourceType: 'ActivityAssignment',
                resourceId: result.assignment.id,
                version: result.assignment.version,
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
