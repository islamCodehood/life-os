import { describe, expect, it } from 'vitest';
import type { CompletionRecord, ReminderRecord } from '@/src/domain/activity/entities';
import {
  calculateActivityProgress,
  recoveryLatencyForCompletion,
  type ActivityOpportunityEvidence,
} from '@/src/domain/activity/progress';
import { classifyCompletionReminderEvidence } from '@/src/domain/activity/reminder';
import type {
  ActivityInstanceId,
  CompletionRecordId,
  FamilyId,
  ReminderRecordId,
} from '@/src/domain/shared/id';

const familyId = '01900000-0000-7000-8000-000000000100' as FamilyId;

function completion(
  instanceId: string,
  occurredAt: string,
  selfInitiated = true,
): CompletionRecord {
  return {
    id: ('01900000-0000-7000-8000-' + instanceId.slice(-12)) as CompletionRecordId,
    familyId,
    activityInstanceId: instanceId as ActivityInstanceId,
    occurredAt: new Date(occurredAt),
    recordedAt: new Date(occurredAt),
    reportedByKind: 'CHILD',
    reportedById: '01900000-0000-7000-8000-000000000102',
    selfInitiated,
    reminderCountAtCompletion: selfInitiated ? 0 : 1,
    source: 'CHILD_SELF',
  };
}

function reminder(input: {
  id: string;
  instanceId: string;
  source: 'SYSTEM' | 'GUARDIAN' | 'CHILD';
  scheduledFor: string;
  deliveredAt: string | null;
}): ReminderRecord {
  return {
    id: input.id as ReminderRecordId,
    familyId,
    activityInstanceId: input.instanceId as ActivityInstanceId,
    source: input.source,
    kind: 'ACTIVITY',
    scheduledFor: new Date(input.scheduledFor),
    attemptedAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
    deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
    acknowledgedAt: null,
  };
}

function opportunity(input: {
  id: string;
  status: ActivityOpportunityEvidence['status'];
  targetAt: string;
  endAt?: string;
  completion?: CompletionRecord | null;
  reminders?: ReminderRecord[];
  version?: number;
}): ActivityOpportunityEvidence {
  return {
    instanceId: input.id,
    version: input.version ?? 1,
    status: input.status,
    targetAt: new Date(input.targetAt),
    opportunityEndsAt: new Date(input.endAt ?? input.targetAt),
    completion: input.completion ?? null,
    reminders: input.reminders ?? [],
  };
}

describe('E4 reminder evidence', () => {
  it('treats child-created reminders as planning rather than external dependency', () => {
    const occurredAt = new Date('2026-10-05T07:00:00.000Z');
    const evidence = classifyCompletionReminderEvidence({
      reporter: 'CHILD',
      occurredAt,
      reminders: [
        reminder({
          id: '01900000-0000-7000-8000-000000000201',
          instanceId: '01900000-0000-7000-8000-000000000301',
          source: 'CHILD',
          scheduledFor: '2026-10-05T06:30:00.000Z',
          deliveredAt: '2026-10-05T06:30:00.000Z',
        }),
      ],
    });

    expect(evidence).toEqual({
      reminderCountAtCompletion: 1,
      externalReminderCountAtCompletion: 0,
      selfInitiated: true,
    });
  });

  it('marks a child completion externally prompted only when an external reminder was delivered first', () => {
    const occurredAt = new Date('2026-10-05T07:00:00.000Z');
    const evidence = classifyCompletionReminderEvidence({
      reporter: 'CHILD',
      occurredAt,
      reminders: [
        reminder({
          id: '01900000-0000-7000-8000-000000000202',
          instanceId: '01900000-0000-7000-8000-000000000302',
          source: 'SYSTEM',
          scheduledFor: '2026-10-05T06:45:00.000Z',
          deliveredAt: '2026-10-05T06:45:00.000Z',
        }),
        reminder({
          id: '01900000-0000-7000-8000-000000000203',
          instanceId: '01900000-0000-7000-8000-000000000302',
          source: 'GUARDIAN',
          scheduledFor: '2026-10-05T07:15:00.000Z',
          deliveredAt: '2026-10-05T07:15:00.000Z',
        }),
      ],
    });

    expect(evidence).toEqual({
      reminderCountAtCompletion: 1,
      externalReminderCountAtCompletion: 1,
      selfInitiated: false,
    });
  });
});

describe('E4 activity progress evidence', () => {
  it('keeps unresolved distinct from missed and excludes excused from consistency', () => {
    const firstId = '01900000-0000-7000-8000-000000000401';
    const recoveryId = '01900000-0000-7000-8000-000000000405';
    const recoveryReminder = reminder({
      id: '01900000-0000-7000-8000-000000000501',
      instanceId: recoveryId,
      source: 'SYSTEM',
      scheduledFor: '2026-10-09T06:45:00.000Z',
      deliveredAt: '2026-10-09T06:45:00.000Z',
    });

    const metrics = calculateActivityProgress([
      opportunity({
        id: firstId,
        status: 'COMPLETED',
        targetAt: '2026-10-05T07:00:00.000Z',
        completion: completion(firstId, '2026-10-05T06:50:00.000Z', true),
      }),
      opportunity({
        id: '01900000-0000-7000-8000-000000000402',
        status: 'EXCUSED',
        targetAt: '2026-10-06T07:00:00.000Z',
      }),
      opportunity({
        id: '01900000-0000-7000-8000-000000000403',
        status: 'AWAITING_RESOLUTION',
        targetAt: '2026-10-07T07:00:00.000Z',
      }),
      opportunity({
        id: '01900000-0000-7000-8000-000000000404',
        status: 'MISSED',
        targetAt: '2026-10-08T07:00:00.000Z',
      }),
      opportunity({
        id: recoveryId,
        status: 'COMPLETED',
        targetAt: '2026-10-09T07:00:00.000Z',
        completion: completion(recoveryId, '2026-10-09T06:55:00.000Z', false),
        reminders: [recoveryReminder],
      }),
    ]);

    expect(metrics.applicableOpportunities).toBe(4);
    expect(metrics.resolvedOpportunities).toBe(3);
    expect(metrics.missedOpportunities).toBe(1);
    expect(metrics.unresolvedOpportunities).toBe(1);
    expect(metrics.excusedOpportunities).toBe(1);
    expect(metrics.consistencyRate).toBeCloseTo(2 / 3);
    expect(metrics.completionRate).toBeCloseTo(2 / 4);
    expect(metrics.dataCoverage).toBeCloseTo(3 / 4);
    expect(metrics.selfInitiationRate).toBeCloseTo(1 / 4);
    expect(metrics.reminderDependencyRate).toBeCloseTo(1 / 4);
    expect(metrics.averageRemindersPerOpportunity).toBeCloseTo(1 / 4);
    expect(metrics.onTimeRate).toBe(1);
    expect(metrics.latestRecoveryLatency).toBe(1);
    expect(metrics.recoveredOnNextOpportunity).toBe(true);
    expect(metrics.coverageComplete).toBe(false);
  });

  it('counts recovery in valid opportunities rather than calendar days', () => {
    const recoveredId = '01900000-0000-7000-8000-000000000603';
    const evidence = [
      opportunity({
        id: '01900000-0000-7000-8000-000000000601',
        status: 'MISSED',
        targetAt: '2026-10-01T07:00:00.000Z',
      }),
      opportunity({
        id: '01900000-0000-7000-8000-000000000602',
        status: 'EXCUSED',
        targetAt: '2026-10-05T07:00:00.000Z',
      }),
      opportunity({
        id: recoveredId,
        status: 'COMPLETED',
        targetAt: '2026-10-08T07:00:00.000Z',
        completion: completion(recoveredId, '2026-10-08T06:55:00.000Z'),
      }),
    ];

    expect(recoveryLatencyForCompletion(evidence, recoveredId)).toBe(1);
    expect(calculateActivityProgress(evidence).latestRecoveryLatency).toBe(1);
  });

  it('does not open recovery from unresolved data alone', () => {
    const completedId = '01900000-0000-7000-8000-000000000702';
    const evidence = [
      opportunity({
        id: '01900000-0000-7000-8000-000000000701',
        status: 'AWAITING_RESOLUTION',
        targetAt: '2026-10-05T07:00:00.000Z',
      }),
      opportunity({
        id: completedId,
        status: 'COMPLETED',
        targetAt: '2026-10-06T07:00:00.000Z',
        completion: completion(completedId, '2026-10-06T07:00:00.000Z'),
      }),
    ];

    const metrics = calculateActivityProgress(evidence);
    expect(metrics.recoveryOpen).toBe(false);
    expect(metrics.latestRecoveryLatency).toBeNull();
    expect(recoveryLatencyForCompletion(evidence, completedId)).toBeNull();
  });
});
