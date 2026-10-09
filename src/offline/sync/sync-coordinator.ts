import { publishOfflineCommandEvent } from '@/src/offline/events';
import type {
  CommandTransport,
  OfflineActorScope,
  OfflineCommandRecord,
  OfflineCommandStore,
} from '@/src/offline/model';

export type SyncOutcome =
  'IDLE' | 'ACCEPTED' | 'RETRYABLE' | 'CONFLICT' | 'FAILED' | 'BLOCKED' | 'ABORTED';

export interface SyncResult {
  outcome: SyncOutcome;
  acceptedCount: number;
}

function activityInstanceId(command: OfflineCommandRecord): string {
  return command.payload.activityInstanceId;
}

export class SyncCoordinator {
  private readonly inFlight = new Map<string, Promise<SyncResult>>();

  constructor(
    private readonly store: OfflineCommandStore,
    private readonly transport: CommandTransport,
    private readonly now: () => Date = () => new Date(),
  ) {}

  sync(scope: OfflineActorScope, signal?: AbortSignal): Promise<SyncResult> {
    const existing = this.inFlight.get(scope.actorKey);
    if (existing) return existing;

    const operation = this.run(scope, signal).finally(() => {
      this.inFlight.delete(scope.actorKey);
    });

    this.inFlight.set(scope.actorKey, operation);
    return operation;
  }

  private async run(scope: OfflineActorScope, signal?: AbortSignal): Promise<SyncResult> {
    await this.store.recoverSyncing(scope.actorKey);

    if (signal?.aborted) return { outcome: 'ABORTED', acceptedCount: 0 };
    if (await this.store.hasConflict(scope.actorKey)) {
      return { outcome: 'BLOCKED', acceptedCount: 0 };
    }

    const commands = await this.store.listPendingCommands(scope.actorKey);
    let acceptedCount = 0;

    for (const command of commands) {
      if (signal?.aborted) return { outcome: 'ABORTED', acceptedCount };

      if (
        command.familyId !== scope.familyId ||
        command.deviceId !== scope.deviceId ||
        command.actorKey !== scope.actorKey
      ) {
        await this.store.updateCommand(scope.actorKey, command.commandId, {
          status: 'FAILED',
          lastErrorCode: 'LOCAL_ACTOR_SCOPE_MISMATCH',
          lastErrorMessage: 'The queued command does not belong to the active actor scope.',
        });
        publishOfflineCommandEvent({
          actorKey: scope.actorKey,
          commandId: command.commandId,
          activityInstanceId: activityInstanceId(command),
          phase: 'FAILED',
          status: 'FAILED',
          errorCode: 'LOCAL_ACTOR_SCOPE_MISMATCH',
          errorMessage: 'The queued command does not belong to the active actor scope.',
        });
        return { outcome: 'FAILED', acceptedCount };
      }

      const attemptAt = this.now().toISOString();
      await this.store.updateCommand(scope.actorKey, command.commandId, {
        status: 'SYNCING',
        lastAttemptAt: attemptAt,
      });
      publishOfflineCommandEvent({
        actorKey: scope.actorKey,
        commandId: command.commandId,
        activityInstanceId: activityInstanceId(command),
        phase: 'SYNCING',
        status: 'SYNCING',
      });

      const result = await this.transport.send(command, signal);

      if (result.kind === 'ACCEPTED') {
        await this.store.removeCommand(scope.actorKey, command.commandId);
        await this.store.clearConflict(scope.actorKey, command.commandId);
        await this.store.markActorSynced(scope.actorKey, result.response.serverTime);
        acceptedCount += 1;
        publishOfflineCommandEvent({
          actorKey: scope.actorKey,
          commandId: command.commandId,
          activityInstanceId: activityInstanceId(command),
          phase: 'ACCEPTED',
          response: result.response,
        });
        continue;
      }

      if (result.kind === 'ABORTED') {
        await this.store.updateCommand(scope.actorKey, command.commandId, {
          status: 'PENDING',
        });
        publishOfflineCommandEvent({
          actorKey: scope.actorKey,
          commandId: command.commandId,
          activityInstanceId: activityInstanceId(command),
          phase: 'PENDING',
          status: 'PENDING',
        });
        return { outcome: 'ABORTED', acceptedCount };
      }

      if (result.kind === 'RETRYABLE') {
        await this.store.updateCommand(scope.actorKey, command.commandId, {
          status: 'PENDING',
          retryCount: command.retryCount + 1,
          lastAttemptAt: attemptAt,
          lastErrorCode: result.code,
          lastErrorMessage: result.message,
        });
        publishOfflineCommandEvent({
          actorKey: scope.actorKey,
          commandId: command.commandId,
          activityInstanceId: activityInstanceId(command),
          phase: 'PENDING',
          status: 'PENDING',
          errorCode: result.code,
          errorMessage: result.message,
        });
        return { outcome: 'RETRYABLE', acceptedCount };
      }

      if (result.kind === 'CONFLICT') {
        await this.store.updateCommand(scope.actorKey, command.commandId, {
          status: 'CONFLICT',
          lastAttemptAt: attemptAt,
          lastErrorCode: result.code,
          lastErrorMessage: result.message,
        });
        await this.store.putConflict({
          commandId: command.commandId,
          actorKey: scope.actorKey,
          familyId: scope.familyId,
          deviceId: scope.deviceId,
          activityInstanceId: activityInstanceId(command),
          code: result.code,
          message: result.message,
          ...(result.requestId ? { requestId: result.requestId } : {}),
          createdAt: attemptAt,
        });
        publishOfflineCommandEvent({
          actorKey: scope.actorKey,
          commandId: command.commandId,
          activityInstanceId: activityInstanceId(command),
          phase: 'CONFLICT',
          status: 'CONFLICT',
          errorCode: result.code,
          errorMessage: result.message,
        });
        return { outcome: 'CONFLICT', acceptedCount };
      }

      await this.store.updateCommand(scope.actorKey, command.commandId, {
        status: 'FAILED',
        retryCount: command.retryCount + 1,
        lastAttemptAt: attemptAt,
        lastErrorCode: result.code,
        lastErrorMessage: result.message,
      });
      publishOfflineCommandEvent({
        actorKey: scope.actorKey,
        commandId: command.commandId,
        activityInstanceId: activityInstanceId(command),
        phase: 'FAILED',
        status: 'FAILED',
        errorCode: result.code,
        errorMessage: result.message,
      });
      return { outcome: 'FAILED', acceptedCount };
    }

    return {
      outcome: acceptedCount > 0 ? 'ACCEPTED' : 'IDLE',
      acceptedCount,
    };
  }
}
