export type OfflineCommandStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'BLOCKED'
  | 'CONFLICT'
  | 'FAILED';

export interface OfflineActorScope {
  actorKey: string;
  familyId: string;
  childId: string;
  deviceId: string;
}

export interface ExpectedVersion {
  resourceType: string;
  resourceId: string;
  version: number;
}

export interface CompleteActivityPayload {
  activityInstanceId: string;
}

export interface OfflineCommandRecord {
  commandId: string;
  actorKey: string;
  familyId: string;
  deviceId: string;
  clientSequence: number;
  schemaVersion: 1;
  type: 'CompleteActivity';
  occurredAt: string;
  createdAt: string;
  expectedVersions: ExpectedVersion[];
  payload: CompleteActivityPayload;
  status: OfflineCommandStatus;
  retryCount: number;
  lastAttemptAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
}

export interface NewOfflineCommand {
  commandId: string;
  schemaVersion: 1;
  type: 'CompleteActivity';
  occurredAt: string;
  createdAt: string;
  expectedVersions: ExpectedVersion[];
  payload: CompleteActivityPayload;
}

export interface OfflineConflictRecord {
  commandId: string;
  actorKey: string;
  familyId: string;
  deviceId: string;
  activityInstanceId: string;
  code: string;
  message: string;
  requestId?: string;
  createdAt: string;
}

export interface AcceptedCommandResponse {
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
}

export type CommandTransportResult =
  | { kind: 'ACCEPTED'; response: AcceptedCommandResponse }
  | { kind: 'RETRYABLE'; code: string; message: string }
  | { kind: 'CONFLICT'; code: string; message: string; requestId?: string }
  | { kind: 'REJECTED'; code: string; message: string; requestId?: string }
  | { kind: 'ABORTED' };

export interface OfflineCommandStore {
  enqueue(scope: OfflineActorScope, command: NewOfflineCommand): Promise<OfflineCommandRecord>;
  listActorCommands(actorKey: string): Promise<OfflineCommandRecord[]>;
  listPendingCommands(actorKey: string): Promise<OfflineCommandRecord[]>;
  recoverSyncing(actorKey: string): Promise<void>;
  updateCommand(
    actorKey: string,
    commandId: string,
    patch: Partial<
      Pick<
        OfflineCommandRecord,
        'status' | 'retryCount' | 'lastAttemptAt' | 'lastErrorCode' | 'lastErrorMessage'
      >
    >,
  ): Promise<OfflineCommandRecord | null>;
  removeCommand(actorKey: string, commandId: string): Promise<void>;
  putConflict(conflict: OfflineConflictRecord): Promise<void>;
  clearConflict(actorKey: string, commandId: string): Promise<void>;
  hasConflict(actorKey: string): Promise<boolean>;
  markActorSynced(actorKey: string, syncedAt: string): Promise<void>;
}

export interface CommandTransport {
  send(command: OfflineCommandRecord, signal?: AbortSignal): Promise<CommandTransportResult>;
}
