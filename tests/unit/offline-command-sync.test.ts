import { describe, expect, it } from 'vitest';
import {
  executeCommandWithDependencies,
  type ExecuteCommandDependencies,
} from '@/src/offline/commands/execute-command';
import type {
  CommandTransport,
  CommandTransportResult,
  OfflineActorScope,
  OfflineCommandRecord,
} from '@/src/offline/model';
import { SyncCoordinator } from '@/src/offline/sync/sync-coordinator';
import { InMemoryOfflineCommandStore } from '../support/in-memory-offline-command-store';

const scopeA: OfflineActorScope = {
  actorKey:
    'child:01900000-0000-7000-8000-000000000100:01900000-0000-7000-8000-000000000101:01900000-0000-7000-8000-000000000102',
  familyId: '01900000-0000-7000-8000-000000000100',
  childId: '01900000-0000-7000-8000-000000000101',
  deviceId: '01900000-0000-7000-8000-000000000102',
};

const scopeB: OfflineActorScope = {
  actorKey:
    'child:01900000-0000-7000-8000-000000000100:01900000-0000-7000-8000-000000000103:01900000-0000-7000-8000-000000000102',
  familyId: '01900000-0000-7000-8000-000000000100',
  childId: '01900000-0000-7000-8000-000000000103',
  deviceId: '01900000-0000-7000-8000-000000000102',
};

const activityA = '01900000-0000-7000-8000-000000000201';
const activityB = '01900000-0000-7000-8000-000000000202';

function dependencies(
  store: InMemoryOfflineCommandStore,
  commandIds: string[],
  observeSignal: () => void = () => undefined,
): ExecuteCommandDependencies {
  return {
    store,
    commandId: () => {
      const commandId = commandIds.shift();
      if (!commandId) throw new Error('Missing command fixture.');
      return commandId;
    },
    now: () => new Date('2026-10-05T07:15:00.000Z'),
    scheduleSync: () => observeSignal(),
    publish: () => undefined,
  };
}

async function enqueue(
  store: InMemoryOfflineCommandStore,
  scope: OfflineActorScope,
  commandId: string,
  activityInstanceId: string,
  occurredAt = '2026-10-05T07:00:00.000Z',
) {
  return executeCommandWithDependencies(
    {
      scope,
      type: 'CompleteActivity',
      occurredAt,
      expectedVersions: [
        {
          resourceType: 'ActivityInstance',
          resourceId: activityInstanceId,
          version: 1,
        },
      ],
      payload: { activityInstanceId },
    },
    dependencies(store, [commandId]),
  );
}

class QueueTransport implements CommandTransport {
  readonly calls: OfflineCommandRecord[] = [];

  constructor(private readonly results: CommandTransportResult[]) {}

  async send(command: OfflineCommandRecord): Promise<CommandTransportResult> {
    this.calls.push(command);
    const result = this.results.shift();
    if (!result) throw new Error('Missing transport result fixture.');
    return result;
  }
}

function accepted(commandId: string): CommandTransportResult {
  return {
    kind: 'ACCEPTED',
    response: {
      commandId,
      status: 'ACCEPTED',
      serverTime: '2026-10-05T07:20:00.000Z',
      data: null,
      resourceVersions: [
        {
          resourceType: 'ActivityInstance',
          resourceId: activityA,
          version: 2,
        },
      ],
      effects: [],
    },
  };
}

describe('E3 offline command facade', () => {
  it('persists intent before signaling sync and allocates actor-scoped client sequence', async () => {
    const store = new InMemoryOfflineCommandStore();
    let persistedAtSignal = 0;

    const first = await executeCommandWithDependencies(
      {
        scope: scopeA,
        type: 'CompleteActivity',
        occurredAt: '2026-10-05T07:00:00.000Z',
        expectedVersions: [
          { resourceType: 'ActivityInstance', resourceId: activityA, version: 1 },
        ],
        payload: { activityInstanceId: activityA },
      },
      dependencies(
        store,
        ['01900000-0000-7000-8000-000000000301'],
        () => {
          persistedAtSignal = store.commands.size;
        },
      ),
    );

    const second = await enqueue(
      store,
      scopeA,
      '01900000-0000-7000-8000-000000000302',
      activityB,
    );

    expect(persistedAtSignal).toBe(1);
    expect(first.clientSequence).toBe(1);
    expect(second.clientSequence).toBe(2);
    expect(first.occurredAt).toBe('2026-10-05T07:00:00.000Z');
    expect(first.status).toBe('PENDING');
  });

  it('keeps sibling command queues isolated even on the same device', async () => {
    const store = new InMemoryOfflineCommandStore();

    await enqueue(
      store,
      scopeA,
      '01900000-0000-7000-8000-000000000303',
      activityA,
    );
    await enqueue(
      store,
      scopeB,
      '01900000-0000-7000-8000-000000000304',
      activityB,
    );

    expect(await store.listActorCommands(scopeA.actorKey)).toHaveLength(1);
    expect(await store.listActorCommands(scopeB.actorKey)).toHaveLength(1);
    expect((await store.listActorCommands(scopeA.actorKey))[0]?.payload.activityInstanceId).toBe(
      activityA,
    );
  });
});

describe('E3 SyncCoordinator', () => {
  it('removes an accepted command and keeps its original real-world occurredAt', async () => {
    const store = new InMemoryOfflineCommandStore();
    const commandId = '01900000-0000-7000-8000-000000000305';
    await enqueue(store, scopeA, commandId, activityA, '2026-10-05T06:58:00.000Z');
    const transport = new QueueTransport([accepted(commandId)]);
    const coordinator = new SyncCoordinator(
      store,
      transport,
      () => new Date('2026-10-05T07:20:00.000Z'),
    );

    const result = await coordinator.sync(scopeA);

    expect(result).toEqual({ outcome: 'ACCEPTED', acceptedCount: 1 });
    expect(transport.calls[0]?.occurredAt).toBe('2026-10-05T06:58:00.000Z');
    expect(await store.listActorCommands(scopeA.actorKey)).toHaveLength(0);
    expect(store.syncedAt.get(scopeA.actorKey)).toBe('2026-10-05T07:20:00.000Z');
  });

  it('retains the same command for retry after a network/server transient failure', async () => {
    const store = new InMemoryOfflineCommandStore();
    const commandId = '01900000-0000-7000-8000-000000000306';
    await enqueue(store, scopeA, commandId, activityA);
    const transport = new QueueTransport([
      {
        kind: 'RETRYABLE',
        code: 'NETWORK_UNAVAILABLE',
        message: 'The network is unavailable.',
      },
    ]);
    const coordinator = new SyncCoordinator(store, transport);

    expect(await coordinator.sync(scopeA)).toMatchObject({ outcome: 'RETRYABLE' });

    const pending = await store.listActorCommands(scopeA.actorKey);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      commandId,
      status: 'PENDING',
      retryCount: 1,
      lastErrorCode: 'NETWORK_UNAVAILABLE',
    });
  });

  it('persists a typed conflict and blocks later replay until it is resolved', async () => {
    const store = new InMemoryOfflineCommandStore();
    const firstId = '01900000-0000-7000-8000-000000000307';
    const secondId = '01900000-0000-7000-8000-000000000308';
    await enqueue(store, scopeA, firstId, activityA);
    await enqueue(store, scopeA, secondId, activityB);

    const transport = new QueueTransport([
      {
        kind: 'CONFLICT',
        code: 'STALE_VERSION',
        message: 'This activity changed on another device.',
        requestId: 'req-conflict',
      },
      accepted(secondId),
    ]);
    const coordinator = new SyncCoordinator(store, transport);

    expect(await coordinator.sync(scopeA)).toMatchObject({ outcome: 'CONFLICT' });
    expect(store.conflicts.get(firstId)).toMatchObject({
      code: 'STALE_VERSION',
      activityInstanceId: activityA,
    });

    const records = await store.listActorCommands(scopeA.actorKey);
    expect(records[0]?.status).toBe('CONFLICT');
    expect(records[1]?.status).toBe('PENDING');

    expect(await coordinator.sync(scopeA)).toEqual({
      outcome: 'BLOCKED',
      acceptedCount: 0,
    });
    expect(transport.calls).toHaveLength(1);
  });

  it('syncs only the active actor queue', async () => {
    const store = new InMemoryOfflineCommandStore();
    const commandA = '01900000-0000-7000-8000-000000000309';
    const commandB = '01900000-0000-7000-8000-000000000310';
    await enqueue(store, scopeA, commandA, activityA);
    await enqueue(store, scopeB, commandB, activityB);

    const transport = new QueueTransport([accepted(commandA)]);
    const coordinator = new SyncCoordinator(store, transport);

    await coordinator.sync(scopeA);

    expect(transport.calls.map((command) => command.commandId)).toEqual([commandA]);
    expect(await store.listActorCommands(scopeB.actorKey)).toHaveLength(1);
  });

  it('recovers a command left in SYNCING after an interrupted client run', async () => {
    const store = new InMemoryOfflineCommandStore();
    const commandId = '01900000-0000-7000-8000-000000000311';
    await enqueue(store, scopeA, commandId, activityA);
    await store.updateCommand(scopeA.actorKey, commandId, { status: 'SYNCING' });

    const transport = new QueueTransport([accepted(commandId)]);
    const coordinator = new SyncCoordinator(store, transport);

    expect(await coordinator.sync(scopeA)).toMatchObject({ outcome: 'ACCEPTED' });
    expect(transport.calls).toHaveLength(1);
  });
});
