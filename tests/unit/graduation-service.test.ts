import { describe, expect, it } from 'vitest';
import type { ActorContext } from '@/src/application/auth/actor-context';
import type { ActivityRepository } from '@/src/application/activity/activity-repository';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import { GraduationService } from '@/src/application/graduation/graduation-service';
import type {
  GraduationAssignment, GraduationRecord, GraduationRepository, GraduationSuggestion,
} from '@/src/application/graduation/graduation-repository';
import type { ActivityOpportunityEvidence } from '@/src/domain/activity/progress';
import type { ActivityAssignmentId, ChildId, FamilyId, GuardianId } from '@/src/domain/shared/id';

const familyId = '01900000-0000-7000-8000-000000000100' as FamilyId;
const childId = '01900000-0000-7000-8000-000000000101' as ChildId;
const guardianId = '01900000-0000-7000-8000-000000000102' as GuardianId;
const assignmentId = '01900000-0000-7000-8000-000000000103' as ActivityAssignmentId;
const guardian: ActorContext = { kind: 'GUARDIAN', familyId, guardianId };
const child: ActorContext = { kind: 'CHILD', familyId, childId, deviceId: '01900000-0000-7000-8000-000000000104' as never };

const on = new Date('2026-10-01T10:00:00Z');
function evidence(status: ActivityOpportunityEvidence['status']): ActivityOpportunityEvidence {
  const completionTime = new Date('2026-10-01T08:00:00Z');
  return {
    instanceId: 'i1', status, version: 1,
    targetAt: completionTime, opportunityEndsAt: on, reminders: [],
    completion: status === 'COMPLETED' ? {
      id: 'c1' as never, familyId, activityInstanceId: 'i1' as never,
      occurredAt: completionTime, recordedAt: completionTime,
      reportedByKind: 'CHILD', reportedById: childId, selfInitiated: true,
      reminderCountAtCompletion: 0, source: 'CHILD_SELF',
    } : null,
  };
}
function fixture(opportunity: ActivityOpportunityEvidence = evidence('COMPLETED')) {
  let assignment: GraduationAssignment = {
    id: assignmentId, familyId, childId, status: 'ACTIVE', version: 1,
    scheduleTimezone: 'UTC', activeFrom: '2026-10-01',
  };
  let activeRecord: GraduationRecord | null = null;
  const suggestions = new Map<string, GraduationSuggestion>();
  const observations: Array<{ id: string; result: 'STABLE' | 'SOMETIMES_NEEDS_HELP' | 'NEEDS_REGULAR_SUPPORT'; observedAt: Date }> = [];
  const events: string[] = [];
  let captured = false;

  const db = {
    getAssignment: async (_familyId: FamilyId, id: ActivityAssignmentId) =>
      id === assignmentId && _familyId === familyId ? assignment : null,
    getMakeBedAssignment: async (_familyId: FamilyId, id: ChildId) =>
      _familyId === familyId && id === childId ? assignment : null,
    getSuggestion: async (_familyId: FamilyId, id: string) => _familyId === familyId ? suggestions.get(id) ?? null : null,
    getPendingSuggestion: async (_familyId: FamilyId, id: ActivityAssignmentId, kind: string) =>
      [...suggestions.values()].find((s) => s.familyId === _familyId && s.assignmentId === id && s.kind === kind && s.status === 'PENDING') ?? null,
    createEvidenceSnapshot: async () => { captured = true; },
    createSuggestion: async (input: {
      id: string; familyId: FamilyId; childId: ChildId; assignmentId: ActivityAssignmentId;
      kind: 'GRADUATION' | 'REACTIVATION'; origin: 'GUARDIAN_REVIEW' | 'MONITORING_EVIDENCE';
      graduationRecordId?: string; createdAt: Date;
    }) => {
      const result: GraduationSuggestion = {
        ...input, graduationRecordId: input.graduationRecordId ?? null, status: 'PENDING',
      };
      suggestions.set(result.id, result);
      return result;
    },
    decideSuggestion: async (_familyId: FamilyId, id: string, status: GraduationSuggestion['status']) => {
      const result = suggestions.get(id);
      if (!result || _familyId !== familyId || result.status !== 'PENDING') return null;
      const updated = { ...result, status };
      suggestions.set(id, updated);
      return updated;
    },
    transitionAssignment: async (input: {
      familyId: FamilyId; assignmentId: ActivityAssignmentId; expectedVersion: number;
      from: 'ACTIVE' | 'GRADUATED'; to: 'ACTIVE' | 'GRADUATED'; activeFrom?: string;
    }) => {
      if (input.familyId !== familyId || input.assignmentId !== assignmentId ||
        assignment.status !== input.from || assignment.version !== input.expectedVersion) return null;
      assignment = { ...assignment, status: input.to, version: assignment.version + 1,
        activeFrom: input.activeFrom ?? assignment.activeFrom };
      return assignment;
    },
    createGraduationRecord: async (input: {
      id: string; familyId: FamilyId; childId: ChildId; assignmentId: ActivityAssignmentId;
      approvedAt: Date; monitoringIntervalDays: number;
    }) => {
      activeRecord = { ...input, status: 'GRADUATED', lastObservedAt: null };
      return activeRecord;
    },
    getActiveGraduation: async (_familyId: FamilyId) => _familyId === familyId ? activeRecord : null,
    listChildGraduatedForRecord: async (_familyId: FamilyId, id: string) =>
      _familyId === familyId && activeRecord?.id === id ? activeRecord : null,
    listChildGraduated: async (_familyId: FamilyId, id: ChildId) =>
      _familyId === familyId && id === childId && activeRecord
        ? [{ record: activeRecord, title: 'Make your bed', templateKey: 'SELF_MAKE_BED' }] : [],
    addObservation: async (input: { id: string; result: 'STABLE' | 'SOMETIMES_NEEDS_HELP' | 'NEEDS_REGULAR_SUPPORT'; observedAt: Date }) => {
      observations.push(input);
      if (activeRecord) activeRecord = { ...activeRecord, lastObservedAt: input.observedAt };
    },
    listObservations: async () => [...observations],
    reactivateRecord: async () => {
      if (!activeRecord) return null;
      activeRecord = { ...activeRecord, status: 'REACTIVATED' };
      const closed = activeRecord;
      activeRecord = null;
      return closed;
    },
  } as unknown as GraduationRepository;
  const activities = {
    listProgressEvidence: async () => [opportunity],
    appendDomainEvent: async (event: { type: string }) => { events.push(event.type); },
  } as unknown as ActivityRepository;
  const identity = {
    getChild: async (_familyId: FamilyId, id: ChildId) => _familyId === familyId && id === childId ? { id } : null,
  } as unknown as IdentityRepository;
  const service = new GraduationService(db, activities, identity);
  return { service, assignment: () => assignment, events, captured: () => captured };
}

describe('E5 graduation authority and monitoring', () => {
  it('does not produce an automatic readiness conclusion or review without guardian', async () => {
    const { service, captured } = fixture();
    await expect(service.requestReview(child, assignmentId, on)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(captured()).toBe(false);
  });

  it('does not suggest graduation with unresolved observations', async () => {
    const { service } = fixture(evidence('AWAITING_RESOLUTION'));
    await expect(service.requestReview(guardian, assignmentId, on)).rejects.toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' });
  });

  it('requires review, guardian authority and expected-version before graduation', async () => {
    const { service, assignment, events } = fixture();
    const review = await service.requestReview(guardian, assignmentId, on);
    expect(assignment().status).toBe('ACTIVE');
    await expect(service.decideGraduation({
      actor: child, suggestionId: review.id, decision: 'APPROVE', expectedVersion: 1, occurredAt: on, now: on,
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.decideGraduation({
      actor: guardian, suggestionId: review.id, decision: 'APPROVE', expectedVersion: 99, occurredAt: on, now: on,
    })).rejects.toMatchObject({ code: 'STALE_VERSION' });
    const approved = await service.decideGraduation({
      actor: guardian, suggestionId: review.id, decision: 'APPROVE', expectedVersion: 1,
      occurredAt: on, now: on,
    });
    expect(approved.graduation?.status).toBe('GRADUATED');
    expect(assignment().status).toBe('GRADUATED');
    expect(events).toContain('ResponsibilityGraduated');
    expect((await service.childGraduated(child)).length).toBe(1);
  });

  it('a single weak observation does not auto-reactivate; guardian decides after repeated support', async () => {
    const { service, assignment, events } = fixture();
    const review = await service.requestReview(guardian, assignmentId, on);
    const approval = await service.decideGraduation({
      actor: guardian, suggestionId: review.id, decision: 'APPROVE', expectedVersion: 1, occurredAt: on, now: on,
    });
    const recordId = approval.graduation!.id;
    const first = await service.recordObservation({
      actor: guardian, graduationRecordId: recordId, result: 'NEEDS_REGULAR_SUPPORT',
      occurredAt: new Date('2026-10-02T10:00:00Z'), now: new Date('2026-10-02T10:00:00Z'),
    });
    expect(first.monitoringState).toBe('WATCH');
    expect(first.reactivationSuggestionId).toBeNull();
    expect(assignment().status).toBe('GRADUATED');
    const second = await service.recordObservation({
      actor: guardian, graduationRecordId: recordId, result: 'NEEDS_REGULAR_SUPPORT',
      occurredAt: new Date('2026-10-03T10:00:00Z'), now: new Date('2026-10-03T10:00:00Z'),
    });
    expect(second.monitoringState).toBe('REACTIVATION_REVIEW');
    expect(second.reactivationSuggestionId).toBeTruthy();
    expect(assignment().status).toBe('GRADUATED');
    await expect(service.decideReactivation({
      actor: child, suggestionId: second.reactivationSuggestionId!, decision: 'APPROVE',
      expectedVersion: 2, occurredAt: new Date('2026-10-03T10:00:00Z'),
      now: new Date('2026-10-03T10:00:00Z'),
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const reactivated = await service.decideReactivation({
      actor: guardian, suggestionId: second.reactivationSuggestionId!, decision: 'APPROVE',
      expectedVersion: 2, occurredAt: new Date('2026-10-03T10:00:00Z'),
      now: new Date('2026-10-03T10:00:00Z'),
    });
    expect(reactivated.assignment.status).toBe('ACTIVE');
    expect(reactivated.assignment.activeFrom).toBe('2026-10-04');
    expect(events).toContain('ResponsibilityReactivated');
  });
});
