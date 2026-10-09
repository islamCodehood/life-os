import { describe, expect, it } from 'vitest';
import { LifeOsLocalDatabase } from '@/src/offline/db/life-os-local-db';

describe('LifeOSLocal Dexie schema', () => {
  it('declares the frozen offline storage groups without opening the database', () => {
    const db = new LifeOsLocalDatabase('LifeOSLocal-schema-test');

    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        'actorState',
        'commandOutbox',
        'conflicts',
        'deviceState',
        'preferences',
        'snapshots',
        'syncState',
      ].sort(),
    );

    db.close();
  });
});
