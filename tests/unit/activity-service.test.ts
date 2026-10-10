import { describe, expect, it } from 'vitest';
import type { ActorContext } from '@/src/application/auth/actor-context';
import type {
  ActivityRepository,
  SchedulingFamily,
} from '@/src/application/activity/activity-repository';
import { ActivityService } from '@/src/application/activity/activity-service';
import type { XpRepository } from '@/src/application/growth/xp-repository';
import type { XpEntry } from '@/src/domain/growth/skill-xp';
import type {
  ActivityAssignment,
  ActivityDefinition,
  ActivityHistoryItem,
  ActivityInstance,
  ActivityInstanceContext,
  ActivityInstanceStatus,
  ActivityTemplate,
  ActivityTemplateKey,
  CompletionRecord,
  ReminderRecord,
} from '@/src/domain/activity/entities';
import type {
  ActivityInstanceId,
  ChildId,
  DeviceId,
  DomainEventId,
  FamilyId,
  GuardianId,
} from '@/src/domain/shared/id';
import { InMemoryIdentityRepository } from '../support/in-memory-identity-repository';

class InMemoryActivityRepository implements ActivityRepository {
  readonly template: ActivityTemplate = {
    key: 'SELF_MAKE_BED',
    title: 'Make your bed',
    description: null,
    why: 'Start the day by caring for your space.',
    category: 'SELF_RESPONSIBILITY',
    defaultScheduleRrule: 'FREQ=DAILY',
    defaultLocalTargetTime: '07:00',
    defaultAvailableOffsetMinutes: -60,
    defaultOpportunityEndOffsetMinutes: 180,
    defaultTrackingMode: 'CHECK',
    defaultCompletionMode: 'SELF',
    defaultApprovalMode: 'NONE',
    defaultProgressMode: 'INDEPENDENCE',
    defaultXpMode: 'TRAINING_ONLY',
  };

  definitions = new Map<string, ActivityDefinition>();
  assignments = new Map<string, ActivityAssignment>();
  instances = new Map<string, ActivityInstance>();
  completions = new Map<ActivityInstanceId, CompletionRecord>();
  reminders = new Map<ActivityInstanceId, ReminderRecord[]>();
  events: Array<{
    id: DomainEventId;
    familyId: FamilyId;
    type: string;
    aggregateType: string;
    aggregateId: string;
    occurredAt: Date;
    recordedAt: Date;
    payload: Record<string, unknown>;
  }> = [];

  async getTemplate(key: ActivityTemplateKey) {
    if (key === this.template.key) return this.template;
    if (key === 'GROWTH_READING' || key === 'GROWTH_CHESS_PRACTICE') {
      return {
        ...this.template,
        key,
        category: 'GROWTH' as const,
        title: key === 'GROWTH_READING' ? 'Reading practice' : 'Chess practice',
        defaultLocalTargetTime: key === 'GROWTH_READING' ? '17:00' : '18:00',
        defaultProgressMode: 'MASTERY',
        defaultXpMode: 'ALLOWED',
      };
    }
    return null;
  }

  async findActiveAssignmentByTemplate(
    familyId: FamilyId,
    childId: ChildId,
    templateKey: ActivityTemplateKey,
  ) {
    for (const assignment of this.assignments.values()) {
      const definition = this.definitions.get(assignment.activityDefinitionId);
      if (
        assignment.familyId === familyId &&
        assignment.childId === childId &&
        assignment.status === 'ACTIVE' &&
        definition?.templateKey === templateKey
      ) {
        return assignment;
      }
    }
    return null;
  }

  async findAssignedByTemplate(
    familyId: FamilyId,
    childId: ChildId,
    templateKey: ActivityTemplateKey,
  ) {
    for (const assignment of this.assignments.values()) {
      const definition = this.definitions.get(assignment.activityDefinitionId);
      if (
        assignment.familyId === familyId &&
        assignment.childId === childId &&
        (assignment.status === 'ACTIVE' || assignment.status === 'GRADUATED') &&
        definition?.templateKey === templateKey
      ) {
        return assignment;
      }
    }
    return null;
  }

  async createDefinition(definition: ActivityDefinition) {
    this.definitions.set(definition.id, definition);
    return definition;
  }

  async createAssignment(assignment: ActivityAssignment) {
    this.assignments.set(assignment.id, assignment);
    return assignment;
  }

  async listActiveAssignmentsForFamily(familyId: FamilyId) {
    return [...this.assignments.values()].filter(
      (assignment) => assignment.familyId === familyId && assignment.status === 'ACTIVE',
    );
  }

  async listSchedulingFamilies(): Promise<SchedulingFamily[]> {
    const families = new Map<FamilyId, string>();
    for (const assignment of this.assignments.values()) {
      families.set(assignment.familyId, assignment.scheduleTimezone);
    }
    return [...families].map(([familyId, timezone]) => ({ familyId, timezone }));
  }

  async ensureInstance(instance: ActivityInstance) {
    const existing = [...this.instances.values()].find(
      (candidate) =>
        candidate.assignmentId === instance.assignmentId &&
        candidate.targetAt.getTime() === instance.targetAt.getTime(),
    );
    if (existing) return existing;
    this.instances.set(instance.id, instance);
    return instance;
  }

  private context(instance: ActivityInstance): ActivityInstanceContext {
    const assignment = this.assignments.get(instance.assignmentId);
    if (!assignment) throw new Error('Assignment missing.');
    const definition = this.definitions.get(assignment.activityDefinitionId);
    if (!definition) throw new Error('Definition missing.');
    return { instance, assignment, definition };
  }

  async listChildInstancesBetween(familyId: FamilyId, childId: ChildId, start: Date, end: Date) {
    return [...this.instances.values()]
      .filter(
        (instance) =>
          instance.familyId === familyId &&
          instance.childId === childId &&
          instance.targetAt >= start &&
          instance.targetAt < end,
      )
      .map((instance) => this.context(instance));
  }

  async getInstanceForUpdate(familyId: FamilyId, instanceId: ActivityInstanceId) {
    const instance = this.instances.get(instanceId);
    return instance?.familyId === familyId ? this.context(instance) : null;
  }

  async getCompletion(familyId: FamilyId, instanceId: ActivityInstanceId) {
    const completion = this.completions.get(instanceId);
    return completion?.familyId === familyId ? completion : null;
  }

  async appendCompletion(record: CompletionRecord) {
    if (!this.completions.has(record.activityInstanceId)) {
      this.completions.set(record.activityInstanceId, record);
    }
  }

  async markInstanceCompleted(
    familyId: FamilyId,
    instanceId: ActivityInstanceId,
    expectedVersion: number,
    updatedAt: Date,
    allowedStatuses: ActivityInstanceStatus[] = ['PENDING'],
  ) {
    void updatedAt;
    const instance = this.instances.get(instanceId);
    if (
      !instance ||
      instance.familyId !== familyId ||
      instance.version !== expectedVersion ||
      !allowedStatuses.includes(instance.status)
    ) {
      return null;
    }
    const updated = { ...instance, status: 'COMPLETED' as const, version: instance.version + 1 };
    this.instances.set(instanceId, updated);
    return updated;
  }

  async updateInstanceStatus(
    familyId: FamilyId,
    instanceId: ActivityInstanceId,
    expectedVersion: number,
    allowedStatuses: ActivityInstanceStatus[],
    status: ActivityInstanceStatus,
    updatedAt: Date,
  ) {
    void updatedAt;
    const instance = this.instances.get(instanceId);
    if (
      !instance ||
      instance.familyId !== familyId ||
      instance.version !== expectedVersion ||
      !allowedStatuses.includes(instance.status)
    ) {
      return null;
    }
    const updated = { ...instance, status, version: instance.version + 1 };
    this.instances.set(instanceId, updated);
    return updated;
  }

  async markExpiredPendingAwaitingResolution(now: Date) {
    let updatedCount = 0;
    for (const [id, instance] of this.instances) {
      if (instance.status === 'PENDING' && instance.opportunityEndsAt <= now) {
        this.instances.set(id, {
          ...instance,
          status: 'AWAITING_RESOLUTION',
          version: instance.version + 1,
        });
        updatedCount += 1;
      }
    }
    return updatedCount;
  }

  async ensureReminder(record: ReminderRecord) {
    const records = this.reminders.get(record.activityInstanceId) ?? [];
    const existing = records.find(
      (candidate) =>
        candidate.source === record.source &&
        candidate.kind === record.kind &&
        candidate.scheduledFor.getTime() === record.scheduledFor.getTime(),
    );
    if (existing) return existing;
    records.push(record);
    this.reminders.set(record.activityInstanceId, records);
    return record;
  }

  async listRemindersForInstance(familyId: FamilyId, instanceId: ActivityInstanceId) {
    return (this.reminders.get(instanceId) ?? []).filter(
      (reminder) => reminder.familyId === familyId,
    );
  }

  async listProgressEvidence(
    familyId: FamilyId,
    assignmentId: ActivityAssignment['id'],
    through: Date,
  ) {
    return [...this.instances.values()]
      .filter(
        (instance) =>
          instance.familyId === familyId &&
          instance.assignmentId === assignmentId &&
          (instance.opportunityEndsAt <= through || instance.status !== 'PENDING'),
      )
      .sort((left, right) => left.targetAt.getTime() - right.targetAt.getTime())
      .map((instance) => ({
        instanceId: instance.id,
        version: instance.version,
        status: instance.status,
        targetAt: instance.targetAt,
        opportunityEndsAt: instance.opportunityEndsAt,
        completion: this.completions.get(instance.id) ?? null,
        reminders: this.reminders.get(instance.id) ?? [],
      }));
  }

  async appendDomainEvent(input: {
    id: DomainEventId;
    familyId: FamilyId;
    type: string;
    aggregateType: string;
    aggregateId: string;
    occurredAt: Date;
    recordedAt: Date;
    payload: Record<string, unknown>;
  }) {
    this.events.push(input);
  }

  async listCompletionHistory(
    familyId: FamilyId,
    childId: ChildId,
    limit = 10,
  ): Promise<ActivityHistoryItem[]> {
    return [...this.completions.values()]
      .filter((completion) => completion.familyId === familyId)
      .map((completion) => {
        const instance = this.instances.get(completion.activityInstanceId);
        if (!instance || instance.childId !== childId) return null;
        const context = this.context(instance);
        return {
          completion,
          title: context.definition.title,
          templateKey: context.definition.templateKey,
          targetAt: instance.targetAt,
        };
      })
      .filter((item): item is ActivityHistoryItem => item !== null)
      .slice(0, limit);
  }
}

function fixture() {
  const identity = new InMemoryIdentityRepository();
  const activities = new InMemoryActivityRepository();

  const familyId = '01900000-0000-7000-8000-000000000100' as FamilyId;
  const guardianId = '01900000-0000-7000-8000-000000000101' as GuardianId;
  const childId = '01900000-0000-7000-8000-000000000102' as ChildId;
  const siblingId = '01900000-0000-7000-8000-000000000103' as ChildId;

  identity.families.set(familyId, {
    id: familyId,
    name: 'Family',
    timezone: 'UTC',
    currency: 'EGP',
    weeklyReviewDay: null,
    version: 1,
  });
  identity.children.set(childId, {
    id: childId,
    familyId,
    displayName: 'Child',
    birthDate: '2018-01-01',
    avatarKey: null,
    status: 'ACTIVE',
    version: 1,
  });
  identity.children.set(siblingId, {
    id: siblingId,
    familyId,
    displayName: 'Sibling',
    birthDate: '2016-01-01',
    avatarKey: null,
    status: 'ACTIVE',
    version: 1,
  });

  const guardian: ActorContext = { kind: 'GUARDIAN', familyId, guardianId };
  const child: ActorContext = {
    kind: 'CHILD',
    familyId,
    childId,
    deviceId: '01900000-0000-7000-8000-000000000104' as DeviceId,
  };
  const sibling: ActorContext = {
    kind: 'CHILD',
    familyId,
    childId: siblingId,
    deviceId: '01900000-0000-7000-8000-000000000105' as DeviceId,
  };

  return {
    identity,
    activities,
    service: new ActivityService(activities, identity),
    familyId,
    guardian,
    child,
    sibling,
    childId,
  };
}

describe('ActivityService Make Bed pilot', () => {
  it('assigns one daily self-responsibility with no money reward', async () => {
    const f = fixture();

    const first = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );
    const replay = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:05:00.000Z'),
    );

    expect(first.created).toBe(true);
    expect(first.assignment).toMatchObject({
      scheduleRrule: 'FREQ=DAILY',
      progressMode: 'INDEPENDENCE',
      xpMode: 'TRAINING_ONLY',
      xpAmount: null,
      approvalMode: 'NONE',
      activeFrom: '2026-10-05',
      reminderPolicy: { systemReminderOffsetMinutes: 0 },
    });
    expect(f.activities.reminders.get(first.instance.id)).toEqual([
      expect.objectContaining({
        source: 'SYSTEM',
        kind: 'ACTIVITY',
        scheduledFor: new Date('2026-10-05T07:00:00.000Z'),
        attemptedAt: null,
        deliveredAt: null,
        acknowledgedAt: null,
      }),
    ]);
    expect(replay.created).toBe(false);
    expect(replay.assignment.id).toBe(first.assignment.id);
    expect(replay.instance.id).toBe(first.instance.id);
  });

  it('allows the assigned child to complete once and records a self-initiated event', async () => {
    const f = fixture();
    const assigned = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );

    const result = await f.service.completeActivity({
      actor: f.child,
      instanceId: assigned.instance.id,
      occurredAt: new Date('2026-10-05T07:00:00.000Z'),
      recordedAt: new Date('2026-10-05T07:00:05.000Z'),
      expectedVersion: 1,
    });

    expect(result.instance.status).toBe('COMPLETED');
    expect(result.instance.version).toBe(2);
    expect(result.completion).toMatchObject({
      selfInitiated: true,
      source: 'CHILD_SELF',
      reportedByKind: 'CHILD',
    });
    expect(f.activities.events).toHaveLength(1);
    expect(f.activities.events[0]).toMatchObject({
      type: 'ActivityCompleted',
      aggregateType: 'ActivityInstance',
    });

    const replay = await f.service.completeActivity({
      actor: f.child,
      instanceId: assigned.instance.id,
      occurredAt: new Date('2026-10-05T07:00:00.000Z'),
      recordedAt: new Date('2026-10-05T07:01:00.000Z'),
      expectedVersion: 1,
    });
    expect(replay.alreadyCompleted).toBe(true);
    expect(f.activities.events).toHaveLength(1);
  });

  it('conceals a sibling activity instead of allowing cross-child completion', async () => {
    const f = fixture();
    const assigned = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );

    await expect(
      f.service.completeActivity({
        actor: f.sibling,
        instanceId: assigned.instance.id,
        occurredAt: new Date('2026-10-05T07:00:00.000Z'),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('rejects completion outside the opportunity window', async () => {
    const f = fixture();
    const assigned = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );

    await expect(
      f.service.completeActivity({
        actor: f.child,
        instanceId: assigned.instance.id,
        occurredAt: new Date('2026-10-05T11:00:00.000Z'),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' });
  });

  it('classifies child completion after a delivered system reminder as externally prompted', async () => {
    const f = fixture();
    const assigned = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );

    const scheduled = f.activities.reminders.get(assigned.instance.id)?.[0];
    if (!scheduled) throw new Error('Expected scheduled reminder fixture.');
    f.activities.reminders.set(assigned.instance.id, [
      {
        ...scheduled,
        attemptedAt: new Date('2026-10-05T06:45:00.000Z'),
        deliveredAt: new Date('2026-10-05T06:45:00.000Z'),
      },
    ]);

    const result = await f.service.completeActivity({
      actor: f.child,
      instanceId: assigned.instance.id,
      occurredAt: new Date('2026-10-05T07:00:00.000Z'),
      expectedVersion: 1,
    });

    expect(result.completion).toMatchObject({
      selfInitiated: false,
      reminderCountAtCompletion: 1,
    });
  });

  it('treats a child-created delivered reminder as planning evidence, not dependency', async () => {
    const f = fixture();
    const assigned = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );

    const scheduled = f.activities.reminders.get(assigned.instance.id)?.[0];
    if (!scheduled) throw new Error('Expected scheduled reminder fixture.');
    f.activities.reminders.set(assigned.instance.id, [
      scheduled,
      {
        ...scheduled,
        id: '01900000-0000-7000-8000-000000000909' as ReminderRecord['id'],
        source: 'CHILD',
        scheduledFor: new Date('2026-10-05T06:30:00.000Z'),
        attemptedAt: new Date('2026-10-05T06:30:00.000Z'),
        deliveredAt: new Date('2026-10-05T06:30:00.000Z'),
      },
    ]);

    const result = await f.service.completeActivity({
      actor: f.child,
      instanceId: assigned.instance.id,
      occurredAt: new Date('2026-10-05T07:00:00.000Z'),
      expectedVersion: 1,
    });

    expect(result.completion).toMatchObject({
      selfInitiated: true,
      reminderCountAtCompletion: 1,
    });
  });

  it('moves expired unreported opportunities to awaiting resolution, never missed', async () => {
    const f = fixture();
    const assigned = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );

    const result = await f.service.materializeCurrentForAllFamilies(
      new Date('2026-10-05T11:00:00.000Z'),
    );

    expect(result.awaitingResolution).toBe(1);
    expect(f.activities.instances.get(assigned.instance.id)).toMatchObject({
      status: 'AWAITING_RESOLUTION',
      version: 2,
    });

    const insight = await f.service.getParentMakeBedInsight(
      f.guardian,
      f.childId,
      new Date('2026-10-05T11:00:00.000Z'),
    );
    expect(insight?.metrics).toMatchObject({
      missedOpportunities: 0,
      unresolvedOpportunities: 1,
      dataCoverage: 0,
      coverageComplete: false,
    });
  });

  it('resolves an opportunity materialized for the first time after its window already ended', async () => {
    const f = fixture();
    await f.service.assignMakeBed(f.guardian, f.childId, new Date('2026-10-05T02:00:00.000Z'));

    const result = await f.service.materializeCurrentForAllFamilies(
      new Date('2026-10-06T11:00:00.000Z'),
    );

    const dayTwo = [...f.activities.instances.values()].find(
      (instance) => instance.targetAt.toISOString() === '2026-10-06T07:00:00.000Z',
    );
    expect(dayTwo).toMatchObject({
      status: 'AWAITING_RESOLUTION',
      version: 2,
    });
    expect(result.awaitingResolution).toBeGreaterThanOrEqual(1);
  });

  it('accepts an offline completion after the scheduler moved the opportunity to awaiting resolution', async () => {
    const f = fixture();
    const assigned = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );

    await f.service.materializeCurrentForAllFamilies(new Date('2026-10-05T11:00:00.000Z'));

    const result = await f.service.completeActivity({
      actor: f.child,
      instanceId: assigned.instance.id,
      occurredAt: new Date('2026-10-05T07:15:00.000Z'),
      recordedAt: new Date('2026-10-05T11:05:00.000Z'),
      expectedVersion: 1,
    });

    expect(result.instance).toMatchObject({
      status: 'COMPLETED',
      version: 3,
    });
    expect(result.completion.occurredAt.toISOString()).toBe('2026-10-05T07:15:00.000Z');
  });

  it('opens recovery only after a guardian-confirmed miss and recognizes the next valid completion', async () => {
    const f = fixture();
    const assigned = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );

    await f.service.materializeCurrentForAllFamilies(new Date('2026-10-05T11:00:00.000Z'));
    await f.service.markActivityMissed({
      actor: f.guardian,
      instanceId: assigned.instance.id,
      expectedVersion: 2,
      recordedAt: new Date('2026-10-05T11:05:00.000Z'),
    });

    const next = (await f.service.materializeFamilyDate(f.familyId, '2026-10-06'))[0];
    if (!next) throw new Error('Expected next activity opportunity.');

    await f.service.completeActivity({
      actor: f.child,
      instanceId: next.id,
      occurredAt: new Date('2026-10-06T06:55:00.000Z'),
      expectedVersion: 1,
    });

    const insight = await f.service.getParentMakeBedInsight(
      f.guardian,
      f.childId,
      new Date('2026-10-06T11:00:00.000Z'),
    );
    expect(insight?.metrics).toMatchObject({
      missedOpportunities: 1,
      latestRecoveryLatency: 1,
      recoveredOnNextOpportunity: true,
      recoveryOpen: false,
    });

    const today = await f.service.getChildToday(f.child, new Date('2026-10-06T08:00:00.000Z'));
    expect(today.sections[0]?.items[0]).toMatchObject({
      status: 'completed',
      recoveryRecognition: true,
    });
  });

  it('excuses unresolved opportunities without reducing consistency evidence', async () => {
    const f = fixture();
    const assigned = await f.service.assignMakeBed(
      f.guardian,
      f.childId,
      new Date('2026-10-05T02:00:00.000Z'),
    );

    await f.service.materializeCurrentForAllFamilies(new Date('2026-10-05T11:00:00.000Z'));
    await f.service.excuseActivity({
      actor: f.guardian,
      instanceId: assigned.instance.id,
      expectedVersion: 2,
    });

    const next = (await f.service.materializeFamilyDate(f.familyId, '2026-10-06'))[0];
    if (!next) throw new Error('Expected next activity opportunity.');
    await f.service.completeActivity({
      actor: f.child,
      instanceId: next.id,
      occurredAt: new Date('2026-10-06T06:55:00.000Z'),
      expectedVersion: 1,
    });

    const insight = await f.service.getParentMakeBedInsight(
      f.guardian,
      f.childId,
      new Date('2026-10-06T11:00:00.000Z'),
    );
    expect(insight?.metrics).toMatchObject({
      applicableOpportunities: 1,
      completedOpportunities: 1,
      excusedOpportunities: 1,
      consistencyRate: 1,
      dataCoverage: 1,
    });
  });

  it('returns only the active child own Today card', async () => {
    const f = fixture();
    await f.service.assignMakeBed(f.guardian, f.childId, new Date('2026-10-05T02:00:00.000Z'));

    const today = await f.service.getChildToday(f.child, new Date('2026-10-05T07:00:00.000Z'));

    expect(today.date).toBe('2026-10-05');
    expect(today.sections[0]?.items).toHaveLength(1);
    expect(today.sections[0]?.items[0]).toMatchObject({
      templateKey: 'SELF_MAKE_BED',
      status: 'pending',
    });
  });
});

class InMemoryXpRepository implements XpRepository {
  entries: XpEntry[] = [];
  async append(entry: XpEntry) {
    if (this.entries.some(e=>e.sourceEventId===entry.sourceEventId)) throw new Error('Duplicate event');
    if (entry.correctionOf && this.entries.some(e=>e.correctionOf===entry.correctionOf)) throw new Error('Already corrected');
    this.entries.push(entry);
  }
  async getEntry(familyId: FamilyId, id: string) {
    return this.entries.find(e=>e.familyId===familyId && e.id===id)??null;
  }
  async hasCorrection(familyId: FamilyId, grantId: string) {
    return this.entries.some(e=>e.familyId===familyId && e.correctionOf===grantId);
  }
  async listChildEntries(familyId: FamilyId, childId: ChildId) {
    return this.entries.filter(e=>e.familyId===familyId && e.childId===childId);
  }
}

describe('E6 Growth practice and canonical XP ledger', () => {
  it('awards Reading XP once per opportunity; replay does not farm XP; Make Bed earns zero', async () => {
    const f=fixture();
    const xp=new InMemoryXpRepository();
    const service=new ActivityService(f.activities,f.identity,undefined,xp);
    const at=new Date('2026-10-05T14:30:00Z');
    const assigned=await service.assignGrowthPractice(f.guardian,f.childId,'GROWTH_READING',at);
    expect(assigned.assignment).toMatchObject({xpMode:'ALLOWED',xpAmount:10,progressMode:'MASTERY'});
    const first=await service.completeActivity({
      actor:f.child,instanceId:assigned.instance.id,
      occurredAt:new Date('2026-10-05T16:45:00Z'),expectedVersion:1,
    });
    expect(first.alreadyCompleted).toBe(false);
    expect(xp.entries).toHaveLength(1);
    expect(xp.entries[0]).toMatchObject({skillKey:'READING',amount:10,entryType:'GRANT'});
    const replay=await service.completeActivity({
      actor:f.child,instanceId:assigned.instance.id,
      occurredAt:new Date('2026-10-05T16:46:00Z'),expectedVersion:1,
    });
    expect(replay.alreadyCompleted).toBe(true);
    expect(xp.entries).toHaveLength(1);
    expect(await service.getChildSkillProgress(f.child,f.childId))
      .toEqual(expect.arrayContaining([expect.objectContaining({skillKey:'READING',xp:10})]));

    const bed=await service.assignMakeBed(f.guardian,f.childId,new Date('2026-10-05T02:00:00Z'));
    await service.completeActivity({
      actor:f.child,instanceId:bed.instance.id,
      occurredAt:new Date('2026-10-05T07:00:00Z'),expectedVersion:1,
    });
    expect(xp.entries).toHaveLength(1);
  });

  it('grants distinct Chess XP, enforces family-scoped corrections, audit, one correction only', async () => {
    const f=fixture();
    const xp=new InMemoryXpRepository();
    const service=new ActivityService(f.activities,f.identity,undefined,xp);
    const assigned=await service.assignGrowthPractice(
      f.guardian,f.childId,'GROWTH_CHESS_PRACTICE',new Date('2026-10-05T15:00:00Z'),
    );
    await service.completeActivity({
      actor:f.child,instanceId:assigned.instance.id,
      occurredAt:new Date('2026-10-05T18:00:00Z'),expectedVersion:1,
    });
    const grant=xp.entries[0];
    if (!grant) throw new Error('Missing XP grant');
    await expect(service.correctXpGrant({
      actor:f.child,xpEntryId:grant.id,reason:'Accidental award',occurredAt:new Date(),
    })).rejects.toMatchObject({code:'FORBIDDEN'});
    const corrected=await service.correctXpGrant({
      actor:f.guardian,xpEntryId:grant.id,reason:'The practice was recorded in error',
      occurredAt:new Date('2026-10-06T09:00:00Z'),
    });
    expect(corrected.reversedAmount).toBe(10);
    expect(xp.entries).toHaveLength(2);
    expect(xp.entries[1]).toMatchObject({
      skillKey:'CHESS',amount:-10,entryType:'CORRECTION',correctionOf:grant.id,
    });
    await expect(service.correctXpGrant({
      actor:f.guardian,xpEntryId:grant.id,reason:'Try correction again',occurredAt:new Date(),
    })).rejects.toMatchObject({code:'RESOURCE_STATE_CHANGED'});
    expect(f.activities.events.map(e=>e.type)).toContain('XpGrantCorrected');
    expect((await service.getChildSkillProgress(f.child,f.childId)).find(e=>e.skillKey==='CHESS')?.xp).toBe(0);
    await expect(service.getChildSkillProgress(f.sibling,f.childId)).rejects.toMatchObject({code:'FORBIDDEN'});
  });
});
