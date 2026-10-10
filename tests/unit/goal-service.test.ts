import { describe, it, expect } from 'vitest';
import { GoalService } from '@/src/application/goals/goal-service';
import type { GoalRepository } from '@/src/application/goals/goal-repository';
import type {
  Goal,
  GoalProgressEntry,
  GoalRevision,
  GoalReflection,
} from '@/src/domain/goals/goal';
import type { ActorContext } from '@/src/application/auth/actor-context';
import type { ChildId, FamilyId, GuardianId, DeviceId } from '@/src/domain/shared/id';
import { InMemoryIdentityRepository } from '../support/in-memory-identity-repository';
import type { ActivityRepository } from '@/src/application/activity/activity-repository';

const familyId = '01900000-0000-7000-8000-000000000200' as FamilyId;
const childId = '01900000-0000-7000-8000-000000000201' as ChildId;
const siblingId = '01900000-0000-7000-8000-000000000202' as ChildId;
const guardianId = '01900000-0000-7000-8000-000000000203' as GuardianId;
const deviceId = '01900000-0000-7000-8000-000000000204' as DeviceId;
const guardian: ActorContext = { kind: 'GUARDIAN', familyId, guardianId };
const child: ActorContext = { kind: 'CHILD', familyId, childId, deviceId };
const sibling: ActorContext = { kind: 'CHILD', familyId, childId: siblingId, deviceId };
const now = new Date('2026-10-10T13:00:00Z');
class MemoryGoals implements GoalRepository {
  goals = new Map<string, Goal>();
  progress: GoalProgressEntry[] = [];
  revisions: GoalRevision[] = [];
  reflections: GoalReflection[] = [];
  async insertGoal(goal: Goal) {
    this.goals.set(goal.id, goal);
  }
  async getGoal(family: string, id: string) {
    const g = this.goals.get(id);
    return g?.familyId === family ? g : null;
  }
  async lockGoal(family: string, id: string) {
    return this.getGoal(family, id);
  }
  async listChildVisible(family: string, child: string) {
    return [...this.goals.values()].filter(
      (g) => g.familyId === family && (g.ownerType === 'FAMILY' || g.ownerChildId === child),
    );
  }
  async listFamilyGoals(family: string) {
    return [...this.goals.values()].filter((g) => g.familyId === family);
  }
  async updateGoal(input: {
    familyId: string;
    id: string;
    expectedVersion: number;
    patch: Partial<Pick<Goal, 'target' | 'targetDate' | 'progress' | 'nextStep' | 'status'>>;
  }) {
    const g = await this.getGoal(input.familyId, input.id);
    if (!g || g.version !== input.expectedVersion) return null;
    const updated = { ...g, ...input.patch, version: g.version + 1 };
    this.goals.set(g.id, updated);
    return updated;
  }
  async insertProgress(entry: GoalProgressEntry) {
    this.progress.push(entry);
  }
  async insertRevision(revision: GoalRevision) {
    this.revisions.push(revision);
  }
  async insertReflection(reflection: GoalReflection) {
    this.reflections.push(reflection);
  }
  async listProgress(family: string, id: string) {
    return this.progress.filter((e) => e.familyId === family && e.goalId === id);
  }
  async listRevisions(family: string, id: string) {
    return this.revisions.filter((e) => e.familyId === family && e.goalId === id);
  }
  async listReflections(family: string, id: string) {
    return this.reflections.filter((e) => e.familyId === family && e.goalId === id);
  }
}
function setup() {
  const identity = new InMemoryIdentityRepository();
  identity.families.set(familyId, {
    id: familyId,
    name: 'Family',
    timezone: 'UTC',
    currency: 'EGP',
    weeklyReviewDay: null,
    version: 1,
  });
  for (const id of [childId, siblingId])
    identity.children.set(id, {
      id,
      familyId,
      displayName: 'Child',
      birthDate: '2017-01-01',
      avatarKey: null,
      status: 'ACTIVE',
      version: 1,
    });
  const repo = new MemoryGoals();
  const events: string[] = [];
  const activity = {
    appendDomainEvent: async (entry: { type: string }) => {
      events.push(entry.type);
    },
  } as unknown as ActivityRepository;
  return { service: new GoalService(repo, identity, activity), repo, events };
}
function createData(
  ownerType: 'CHILD' | 'FAMILY' = 'CHILD',
  ownerChildId: string | null = childId,
) {
  return {
    ownerType,
    ownerChildId,
    category: ownerType === 'FAMILY' ? ('SHARED' as const) : ('PERSONAL' as const),
    title: 'Collect books',
    why: 'Learn and share',
    nextStep: 'Choose a book',
    target: 4,
    targetDate: '2026-10-05',
    occurredAt: now,
    now,
  };
}
describe('E7: personal & shared goal lifecycle', () => {
  it('child proposal requires guardian approval; age never auto-unlocks', async () => {
    const f = setup();
    const goal = await f.service.create(child, createData());
    expect(goal.status).toBe('AWAITING_APPROVAL');
    await expect(
      f.service.addProgress(child, {
        id: goal.id,
        amount: 1,
        step: 'First book',
        expectedVersion: 1,
        occurredAt: now,
      }),
    ).rejects.toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' });
    await expect(
      f.service.transition(child, {
        id: goal.id,
        to: 'ACTIVE',
        expectedVersion: 1,
        occurredAt: now,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const active = await f.service.transition(guardian, {
      id: goal.id,
      to: 'ACTIVE',
      expectedVersion: 1,
      occurredAt: now,
    });
    expect(active.status).toBe('ACTIVE');
  });
  it('sibling cannot see private goal, contribute or reflect; both can share family goal', async () => {
    const f = setup();
    const personal = await f.service.create(guardian, createData());
    const shared = await f.service.create(guardian, createData('FAMILY', null));
    expect((await f.service.listVisible(sibling, now)).map((g) => g.id)).toEqual([shared.id]);
    await expect(f.service.history(sibling, personal.id)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
    await expect(
      f.service.addProgress(sibling, {
        id: personal.id,
        amount: 1,
        step: 'Spy',
        expectedVersion: 1,
        occurredAt: now,
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    const first = await f.service.addProgress(child, {
      id: shared.id,
      amount: 1,
      step: 'Chose one book',
      expectedVersion: 1,
      occurredAt: now,
    });
    const second = await f.service.addProgress(sibling, {
      id: shared.id,
      amount: 2,
      step: 'Organized donations',
      expectedVersion: 2,
      occurredAt: now,
    });
    expect(second.goal.progress).toBe(3);
    const history = await f.service.history(child, shared.id);
    expect(history.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step: 'Chose one book' }),
        expect.objectContaining({ step: 'Organized donations' }),
      ]),
    );
    expect(JSON.stringify(history)).not.toContain(siblingId);
    expect(JSON.stringify(await f.service.listVisible(child, now))).not.toContain(
      'contributedByChildId',
    );
    expect(first.goal.ownerType).toBe('FAMILY');
  });
  it('expiry never fails goal, revision appends previous target and stale progress conflicts', async () => {
    const f = setup();
    const g = await f.service.create(guardian, createData());
    const late = (await f.service.listVisible(child, now)).find((v) => v.id === g.id);
    expect(late?.status).toBe('TARGET_DATE_REACHED');
    const updated = await f.service.addProgress(child, {
      id: g.id,
      amount: 2,
      step: 'Done two',
      expectedVersion: 1,
      occurredAt: now,
    });
    expect(updated.goal.progress).toBe(2);
    await expect(
      f.service.addProgress(child, {
        id: g.id,
        amount: 1,
        step: 'Old view',
        expectedVersion: 1,
        occurredAt: now,
      }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' });
    await expect(
      f.service.revise(child, {
        id: g.id,
        target: 5,
        targetDate: null,
        reason: 'Extend',
        expectedVersion: 2,
        occurredAt: now,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const revised = await f.service.revise(guardian, {
      id: g.id,
      target: 5,
      targetDate: null,
      reason: 'More time',
      expectedVersion: 2,
      occurredAt: now,
    });
    expect(revised.targetDate).toBeNull();
    expect(f.repo.revisions).toMatchObject([
      { previousTarget: 4, newTarget: 5, reason: 'More time' },
    ]);
    expect((await f.service.history(child, g.id)).entries).toHaveLength(1);
  });
  it('pause/resume, achieve/close and reflection retain facts, never create FAILED', async () => {
    const f = setup();
    const g = await f.service.create(guardian, createData());
    const pause = await f.service.transition(guardian, {
      id: g.id,
      to: 'PAUSED',
      expectedVersion: 1,
      occurredAt: now,
    });
    await expect(
      f.service.addProgress(child, {
        id: g.id,
        amount: 1,
        step: 'Not now',
        expectedVersion: 2,
        occurredAt: now,
      }),
    ).rejects.toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' });
    const resume = await f.service.transition(guardian, {
      id: g.id,
      to: 'ACTIVE',
      expectedVersion: 2,
      occurredAt: now,
    });
    await f.service.addProgress(child, {
      id: g.id,
      amount: 4,
      step: 'All done',
      expectedVersion: 3,
      occurredAt: now,
    });
    const achieved = await f.service.transition(guardian, {
      id: g.id,
      to: 'ACHIEVED',
      expectedVersion: 4,
      occurredAt: now,
    });
    expect(achieved.status).toBe('ACHIEVED');
    const reflection = await f.service.reflect(child, {
      id: g.id,
      text: 'I can plan books',
      occurredAt: now,
    });
    expect(reflection.goalId).toBe(g.id);
    expect((await f.service.history(guardian, g.id)).reflections).toHaveLength(1);
    expect(f.events).toContain('GoalReflectionRecorded');
    expect(pause.version).toBe(2);
    expect(resume.version).toBe(3);
    const another = await f.service.create(guardian, createData());
    const closed = await f.service.transition(guardian, {
      id: another.id,
      to: 'CLOSED',
      expectedVersion: 1,
      occurredAt: now,
    });
    expect(closed.status).toBe('CLOSED');
    expect((await f.service.listVisible(guardian, now)).some((v) => v.status === 'FAILED')).toBe(
      false,
    );
  });
});
