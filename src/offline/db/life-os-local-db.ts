import Dexie, { type Table } from 'dexie';
import type { OfflineCommandRecord, OfflineConflictRecord } from '@/src/offline/model';

export interface SnapshotRecord<T = unknown> {
  id: string;
  actorKey: string;
  resourceKey: string;
  data: T;
  serverUpdatedAt?: string;
  cachedAt: string;
  schemaVersion: number;
  privacy: 'CHILD_SAFE' | 'FAMILY_SHARED' | 'GUARDIAN_PRIVATE';
}

export interface SyncStateRecord {
  actorKey: string;
  nextClientSequence: number;
  lastSyncedAt?: string;
}

export interface ActorStateRecord {
  actorKey: string;
  familyId: string;
  childId?: string;
  deviceId: string;
  updatedAt: string;
}

export interface PreferenceRecord {
  id: string;
  actorKey: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface DeviceStateRecord {
  id: string;
  actorKey: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

export class LifeOsLocalDatabase extends Dexie {
  snapshots!: Table<SnapshotRecord, string>;
  commandOutbox!: Table<OfflineCommandRecord, string>;
  conflicts!: Table<OfflineConflictRecord, string>;
  syncState!: Table<SyncStateRecord, string>;
  actorState!: Table<ActorStateRecord, string>;
  preferences!: Table<PreferenceRecord, string>;
  deviceState!: Table<DeviceStateRecord, string>;

  constructor(name = 'LifeOSLocal') {
    super(name);

    this.version(1).stores({
      snapshots: 'id, actorKey, [actorKey+resourceKey], cachedAt, privacy',
      commandOutbox:
        'commandId, actorKey, status, [actorKey+status], [actorKey+clientSequence], createdAt',
      conflicts: 'commandId, actorKey, [actorKey+createdAt], code',
      syncState: 'actorKey',
      actorState: 'actorKey, familyId, childId, deviceId',
      preferences: 'id, actorKey, key',
      deviceState: 'id, actorKey, key',
    });
  }
}

let browserDatabase: LifeOsLocalDatabase | null = null;

export function getLifeOsLocalDatabase(): LifeOsLocalDatabase {
  if (typeof indexedDB === 'undefined') {
    throw new Error('Life OS local database is only available in an IndexedDB-capable client.');
  }

  browserDatabase ??= new LifeOsLocalDatabase();
  return browserDatabase;
}
