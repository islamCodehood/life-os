import { describe, expect, it } from 'vitest';
import type { ActorContext } from '@/src/application/auth/actor-context';
import type { WorldFact, WorldScope } from '@/src/domain/visual-world/world';
import type { WorldRepository } from '@/src/application/visual-world/world-repository';
import { WorldService } from '@/src/application/visual-world/world-service';
import type { ChildId, FamilyId, GuardianId, DeviceId } from '@/src/domain/shared/id';
import { InMemoryIdentityRepository } from '../support/in-memory-identity-repository';
const familyId = '01900000-0000-7000-8000-000000000510' as FamilyId;
const childA = '01900000-0000-7000-8000-000000000511' as ChildId;
const childB = '01900000-0000-7000-8000-000000000512' as ChildId;
const deviceId = '01900000-0000-7000-8000-000000000513' as DeviceId;
const guardian: ActorContext = {
  kind: 'GUARDIAN',
  familyId,
  guardianId: '01900000-0000-7000-8000-000000000514' as GuardianId,
};
const actorA: ActorContext = { kind: 'CHILD', familyId, childId: childA, deviceId };
const actorB: ActorContext = { kind: 'CHILD', familyId, childId: childB, deviceId };
const now = new Date('2026-10-11T19:00:00Z');
function fact(childId: string | null, key: WorldFact['milestoneKey'], id: string): WorldFact {
  return {
    childId,
    scope: childId === null ? 'FAMILY' : 'PERSONAL',
    familyId,
    sourceEventId: id,
    milestoneKey: key,
    dimension: 'FAMILY',
    occurredAt: now,
    recordedAt: now,
  };
}
class MemoryWorld implements WorldRepository {
  all: WorldFact[] = [];
  stored: WorldFact[] = [];
  projectCalls = 0;
  async sourceFacts(family: string) {
    this.projectCalls++;
    return this.all.filter((f) => f.familyId === family);
  }
  async ensureUnlocks(input: readonly WorldFact[]) {
    for (const f of input) {
      if (
        !this.stored.some(
          (x) => x.sourceEventId === f.sourceEventId && x.milestoneKey === f.milestoneKey,
        )
      )
        this.stored.push({ ...f });
    }
  }
  async listPersisted(familyId: string, scope: WorldScope, childId: string | null) {
    return this.stored
      .filter((f) => f.familyId === familyId && f.scope === scope && f.childId === childId)
      .map((f) => ({ sourceEventId: f.sourceEventId, milestoneKey: f.milestoneKey }));
  }
}
function setup() {
  const identity = new InMemoryIdentityRepository();
  identity.families.set(familyId, {
    id: familyId,
    name: 'Family',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
    weeklyReviewDay: null,
    version: 1,
  });
  for (const id of [childA, childB])
    identity.children.set(id, {
      id,
      familyId,
      displayName: 'Child',
      birthDate: '2017-01-01',
      avatarKey: null,
      status: 'ACTIVE',
      version: 1,
    });
  const repo = new MemoryWorld();
  return { service: new WorldService(repo, identity), repo };
}
describe('E10 personal/family privacy and idempotent projection', () => {
  it('never exposes sibling personal milestones or their source events', async () => {
    const { service, repo } = setup();
    repo.all = [
      fact(childA, 'HOME_PATH', 'a'),
      fact(childB, 'LIBRARY_OPEN', 'b'),
      fact(null, 'FAMILY_TREE', 'family'),
    ];
    await expect(service.read(actorA, 'PERSONAL', childB, now)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
    const own = await service.read(actorA, 'PERSONAL', childA, now);
    expect(own.unlocks.map((u) => u.semanticKey)).toEqual(['HOME_PATH']);
    expect(JSON.stringify(own)).not.toContain('LIBRARY_OPEN');
    const shared = await service.read(actorA, 'FAMILY', null, now);
    expect(shared.unlocks.map((u) => u.semanticKey)).toEqual(['FAMILY_TREE']);
    expect(JSON.stringify(shared)).not.toContain('childB');
    expect((await service.read(actorB, 'FAMILY', null, now)).unlocks).toEqual(shared.unlocks);
    expect((await service.read(guardian, 'PERSONAL', childB, now)).unlocks[0]?.semanticKey).toBe(
      'LIBRARY_OPEN',
    );
  });
  it('backfills source milestones idempotently on every read', async () => {
    const { service, repo } = setup();
    repo.all = [fact(childA, 'HOME_PATH', 'first'), fact(childA, 'HOME_PATH', 'second')];
    const one = await service.read(actorA, 'PERSONAL', childA, now);
    const two = await service.read(actorA, 'PERSONAL', childA, now);
    expect(repo.stored).toHaveLength(1);
    expect(one.unlocks).toEqual(two.unlocks);
  });
  it('does not display a source revoked by canonical facts after an archive or correction', async () => {
    const { service, repo } = setup();
    repo.all = [fact(childA, 'GIVING_GARDEN', 'moment')];
    expect((await service.read(actorA, 'PERSONAL', childA, now)).unlocks).toHaveLength(1);
    repo.all = [];
    expect((await service.read(actorA, 'PERSONAL', childA, now)).unlocks).toHaveLength(0);
    expect(repo.stored).toHaveLength(1); // Audit is retained, but it is not visible to children.
  });
  it('rejects system actors and invalid family-to-child ownership', async () => {
    const { service } = setup();
    await expect(service.read({ kind: 'SYSTEM' }, 'FAMILY', null)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(service.read(actorA, 'FAMILY', childA)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });
});
