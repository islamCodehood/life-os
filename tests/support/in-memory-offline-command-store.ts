import type {
  NewOfflineCommand,
  OfflineActorScope,
  OfflineCommandRecord,
  OfflineCommandStore,
  OfflineConflictRecord,
} from '@/src/offline/model';

export class InMemoryOfflineCommandStore implements OfflineCommandStore {
  readonly commands = new Map<string, OfflineCommandRecord>();
  readonly conflicts = new Map<string, OfflineConflictRecord>();
  readonly syncedAt = new Map<string, string>();
  private readonly nextSequence = new Map<string, number>();

  async enqueue(
    scope: OfflineActorScope,
    command: NewOfflineCommand,
  ): Promise<OfflineCommandRecord> {
    const clientSequence = this.nextSequence.get(scope.actorKey) ?? 1;
    this.nextSequence.set(scope.actorKey, clientSequence + 1);

    const record: OfflineCommandRecord = {
      ...command,
      actorKey: scope.actorKey,
      familyId: scope.familyId,
      deviceId: scope.deviceId,
      clientSequence,
      status: 'PENDING',
      retryCount: 0,
    };
    this.commands.set(record.commandId, record);
    return record;
  }

  async listActorCommands(actorKey: string): Promise<OfflineCommandRecord[]> {
    return [...this.commands.values()]
      .filter((record) => record.actorKey === actorKey)
      .sort((left, right) => left.clientSequence - right.clientSequence);
  }

  async listPendingCommands(actorKey: string): Promise<OfflineCommandRecord[]> {
    return (await this.listActorCommands(actorKey)).filter((record) => record.status === 'PENDING');
  }

  async recoverSyncing(actorKey: string): Promise<void> {
    for (const [commandId, record] of this.commands) {
      if (record.actorKey === actorKey && record.status === 'SYNCING') {
        this.commands.set(commandId, { ...record, status: 'PENDING' });
      }
    }
  }

  async updateCommand(
    actorKey: string,
    commandId: string,
    patch: Partial<
      Pick<
        OfflineCommandRecord,
        'status' | 'retryCount' | 'lastAttemptAt' | 'lastErrorCode' | 'lastErrorMessage'
      >
    >,
  ): Promise<OfflineCommandRecord | null> {
    const existing = this.commands.get(commandId);
    if (!existing || existing.actorKey !== actorKey) return null;

    const updated = { ...existing, ...patch };
    this.commands.set(commandId, updated);
    return updated;
  }

  async removeCommand(actorKey: string, commandId: string): Promise<void> {
    if (this.commands.get(commandId)?.actorKey === actorKey) {
      this.commands.delete(commandId);
    }
  }

  async putConflict(conflict: OfflineConflictRecord): Promise<void> {
    this.conflicts.set(conflict.commandId, conflict);
  }

  async clearConflict(actorKey: string, commandId: string): Promise<void> {
    if (this.conflicts.get(commandId)?.actorKey === actorKey) {
      this.conflicts.delete(commandId);
    }
  }

  async hasConflict(actorKey: string): Promise<boolean> {
    return [...this.conflicts.values()].some((conflict) => conflict.actorKey === actorKey);
  }

  async markActorSynced(actorKey: string, syncedAt: string): Promise<void> {
    this.syncedAt.set(actorKey, syncedAt);
  }
}
