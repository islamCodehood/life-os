import type {
  NewOfflineCommand,
  OfflineActorScope,
  OfflineCommandRecord,
  OfflineCommandStore,
  OfflineConflictRecord,
} from '@/src/offline/model';
import { getLifeOsLocalDatabase, type LifeOsLocalDatabase } from './life-os-local-db';

export class DexieOfflineCommandStore implements OfflineCommandStore {
  constructor(private readonly db: LifeOsLocalDatabase = getLifeOsLocalDatabase()) {}

  async enqueue(
    scope: OfflineActorScope,
    command: NewOfflineCommand,
  ): Promise<OfflineCommandRecord> {
    return this.db.transaction(
      'rw',
      this.db.commandOutbox,
      this.db.syncState,
      this.db.actorState,
      async () => {
        const current = await this.db.syncState.get(scope.actorKey);
        const clientSequence = current?.nextClientSequence ?? 1;

        const record: OfflineCommandRecord = {
          ...command,
          actorKey: scope.actorKey,
          familyId: scope.familyId,
          deviceId: scope.deviceId,
          clientSequence,
          status: 'PENDING',
          retryCount: 0,
        };

        await this.db.commandOutbox.add(record);
        await this.db.syncState.put({
          actorKey: scope.actorKey,
          nextClientSequence: clientSequence + 1,
          ...(current?.lastSyncedAt ? { lastSyncedAt: current.lastSyncedAt } : {}),
        });
        await this.db.actorState.put({
          actorKey: scope.actorKey,
          familyId: scope.familyId,
          childId: scope.childId,
          deviceId: scope.deviceId,
          updatedAt: command.createdAt,
        });

        return record;
      },
    );
  }

  async listActorCommands(actorKey: string): Promise<OfflineCommandRecord[]> {
    const records = await this.db.commandOutbox.where('actorKey').equals(actorKey).toArray();
    return records.sort((left, right) => left.clientSequence - right.clientSequence);
  }

  async listPendingCommands(actorKey: string): Promise<OfflineCommandRecord[]> {
    return (await this.listActorCommands(actorKey)).filter((record) => record.status === 'PENDING');
  }

  async recoverSyncing(actorKey: string): Promise<void> {
    await this.db.commandOutbox
      .where('actorKey')
      .equals(actorKey)
      .and((record) => record.status === 'SYNCING')
      .modify({ status: 'PENDING' });
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
    return this.db.transaction('rw', this.db.commandOutbox, async () => {
      const existing = await this.db.commandOutbox.get(commandId);
      if (!existing || existing.actorKey !== actorKey) return null;

      await this.db.commandOutbox.update(commandId, patch);
      return (await this.db.commandOutbox.get(commandId)) ?? null;
    });
  }

  async removeCommand(actorKey: string, commandId: string): Promise<void> {
    await this.db.transaction('rw', this.db.commandOutbox, async () => {
      const existing = await this.db.commandOutbox.get(commandId);
      if (existing?.actorKey === actorKey) {
        await this.db.commandOutbox.delete(commandId);
      }
    });
  }

  async putConflict(conflict: OfflineConflictRecord): Promise<void> {
    await this.db.conflicts.put(conflict);
  }

  async clearConflict(actorKey: string, commandId: string): Promise<void> {
    await this.db.transaction('rw', this.db.conflicts, async () => {
      const existing = await this.db.conflicts.get(commandId);
      if (existing?.actorKey === actorKey) {
        await this.db.conflicts.delete(commandId);
      }
    });
  }

  async hasConflict(actorKey: string): Promise<boolean> {
    return (await this.db.conflicts.where('actorKey').equals(actorKey).count()) > 0;
  }

  async markActorSynced(actorKey: string, syncedAt: string): Promise<void> {
    await this.db.transaction('rw', this.db.syncState, async () => {
      const current = await this.db.syncState.get(actorKey);
      await this.db.syncState.put({
        actorKey,
        nextClientSequence: current?.nextClientSequence ?? 1,
        lastSyncedAt: syncedAt,
      });
    });
  }
}
