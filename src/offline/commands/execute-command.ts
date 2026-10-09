import { v7 as uuidv7 } from 'uuid';
import { getBrowserOfflineRuntime } from '@/src/offline/browser-runtime';
import { publishOfflineCommandEvent, type OfflineCommandEvent } from '@/src/offline/events';
import type {
  ExpectedVersion,
  OfflineActorScope,
  OfflineCommandRecord,
  OfflineCommandStore,
} from '@/src/offline/model';

export interface ExecuteCompleteActivityInput {
  scope: OfflineActorScope;
  type: 'CompleteActivity';
  payload: {
    activityInstanceId: string;
  };
  expectedVersions: ExpectedVersion[];
  occurredAt?: string;
}

export interface ExecuteCommandDependencies {
  store: OfflineCommandStore;
  commandId: () => string;
  now: () => Date;
  scheduleSync: (scope: OfflineActorScope) => void;
  publish: (event: OfflineCommandEvent) => void;
}

export async function executeCommandWithDependencies(
  input: ExecuteCompleteActivityInput,
  dependencies: ExecuteCommandDependencies,
): Promise<OfflineCommandRecord> {
  const capturedAt = dependencies.now().toISOString();
  const occurredAt = input.occurredAt ?? capturedAt;
  const commandId = dependencies.commandId();

  const record = await dependencies.store.enqueue(input.scope, {
    commandId,
    schemaVersion: 1,
    type: input.type,
    occurredAt,
    createdAt: capturedAt,
    expectedVersions: input.expectedVersions,
    payload: input.payload,
  });

  dependencies.publish({
    actorKey: input.scope.actorKey,
    commandId,
    activityInstanceId: input.payload.activityInstanceId,
    phase: 'QUEUED',
    status: 'PENDING',
  });
  dependencies.scheduleSync(input.scope);

  return record;
}

export async function executeCommand(
  input: ExecuteCompleteActivityInput,
): Promise<OfflineCommandRecord> {
  const runtime = getBrowserOfflineRuntime();

  return executeCommandWithDependencies(input, {
    store: runtime.store,
    commandId: () => uuidv7(),
    now: () => new Date(),
    scheduleSync: (scope) => runtime.scheduleSync(scope),
    publish: publishOfflineCommandEvent,
  });
}
