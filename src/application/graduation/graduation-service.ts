import type { ActorContext } from '@/src/application/auth/actor-context';
import type { ActivityRepository } from '@/src/application/activity/activity-repository';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import { calculateActivityProgress } from '@/src/domain/activity/progress';
import { monitoringState, type ObservationResult } from '@/src/domain/graduation/monitoring';
import { localDateInTimezone } from '@/src/domain/activity/schedule';
import {
  newId,
  type ActivityAssignmentId,
  type ChildId,
  type DomainEventId,
} from '@/src/domain/shared/id';
import type { GraduationRepository, GraduationSuggestion } from './graduation-repository';

export class GraduationDomainError extends Error {
  constructor(
    readonly code:
      | 'FORBIDDEN'
      | 'RESOURCE_NOT_FOUND'
      | 'STALE_VERSION'
      | 'RESOURCE_STATE_CHANGED'
      | 'DOMAIN_RULE_VIOLATION',
    message: string,
  ) {
    super(message);
    this.name = 'GraduationDomainError';
  }
}

function guardian(actor: ActorContext): Extract<ActorContext, { kind: 'GUARDIAN' }> {
  if (actor.kind !== 'GUARDIAN')
    throw new GraduationDomainError('FORBIDDEN', 'Guardian permission is required.');
  return actor;
}
function nextLocalDate(timezone: string, now: Date) {
  const today = localDateInTimezone(timezone, now);
  const next = new Date(`${today}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export class GraduationService {
  constructor(
    private readonly repository: GraduationRepository,
    private readonly activities: ActivityRepository,
    private readonly identity: IdentityRepository,
  ) {}

  private async assignmentForGuardian(actor: ActorContext, assignmentId: ActivityAssignmentId) {
    const owner = guardian(actor);
    const assignment = await this.repository.getAssignment(owner.familyId, assignmentId);
    if (!assignment)
      throw new GraduationDomainError('RESOURCE_NOT_FOUND', 'Responsibility was not found.');
    if (!(await this.identity.getChild(owner.familyId, assignment.childId))) {
      throw new GraduationDomainError('RESOURCE_NOT_FOUND', 'Child was not found.');
    }
    return { owner, assignment };
  }

  private async guardianSuggestion(
    actor: ActorContext,
    suggestionId: string,
    kind: GraduationSuggestion['kind'],
  ) {
    const owner = guardian(actor);
    const suggestion = await this.repository.getSuggestion(owner.familyId, suggestionId);
    if (!suggestion || suggestion.kind !== kind) {
      throw new GraduationDomainError('RESOURCE_NOT_FOUND', 'Review was not found.');
    }
    const { assignment } = await this.assignmentForGuardian(actor, suggestion.assignmentId);
    if (assignment.childId !== suggestion.childId) {
      throw new GraduationDomainError(
        'RESOURCE_NOT_FOUND',
        'Review does not belong to this child.',
      );
    }
    if (suggestion.status !== 'PENDING') {
      throw new GraduationDomainError(
        'RESOURCE_STATE_CHANGED',
        'This review is no longer pending.',
      );
    }
    return { owner, suggestion, assignment };
  }

  async requestReview(actor: ActorContext, assignmentId: ActivityAssignmentId, now = new Date()) {
    const { owner, assignment } = await this.assignmentForGuardian(actor, assignmentId);
    const pilot = await this.repository.getMakeBedAssignment(owner.familyId, assignment.childId);
    if (!pilot || pilot.id !== assignment.id) {
      throw new GraduationDomainError(
        'DOMAIN_RULE_VIOLATION',
        'E5 currently supports the Make Bed responsibility only.',
      );
    }
    if (assignment.status !== 'ACTIVE') {
      throw new GraduationDomainError(
        'RESOURCE_STATE_CHANGED',
        'Only active responsibilities can be reviewed for graduation.',
      );
    }
    const existing = await this.repository.getPendingSuggestion(
      owner.familyId,
      assignment.id,
      'GRADUATION',
    );
    if (existing) return existing;

    const metrics = calculateActivityProgress(
      await this.activities.listProgressEvidence(owner.familyId, assignment.id, now),
    );
    // An explicit guardian review is NOT an algorithmic readiness recommendation.
    // Do not invent a minimum sample size or readiness percentage.
    if (
      metrics.applicableOpportunities === 0 ||
      !metrics.coverageComplete ||
      metrics.recoveryOpen
    ) {
      throw new GraduationDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Resolve observation gaps and open recovery before requesting a graduation review.',
      );
    }
    const evidenceSnapshotId = newId<'GraduationEvidenceSnapshotId'>();
    await this.repository.createEvidenceSnapshot({
      id: evidenceSnapshotId,
      familyId: owner.familyId,
      assignmentId: assignment.id,
      capturedAt: now,
      metrics,
    });
    const review = await this.repository.createSuggestion({
      id: newId<'GraduationSuggestionId'>(),
      familyId: owner.familyId,
      childId: assignment.childId,
      assignmentId: assignment.id,
      kind: 'GRADUATION',
      origin: 'GUARDIAN_REVIEW',
      evidenceSnapshotId,
      createdAt: now,
    });
    return review;
  }

  async decideGraduation(input: {
    actor: ActorContext;
    suggestionId: string;
    decision: 'APPROVE' | 'DECLINE' | 'SNOOZE';
    expectedVersion?: number;
    monitoringIntervalDays?: number;
    occurredAt: Date;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const { owner, suggestion, assignment } = await this.guardianSuggestion(
      input.actor,
      input.suggestionId,
      'GRADUATION',
    );
    if (input.decision !== 'APPROVE') {
      const decided = await this.repository.decideSuggestion(
        owner.familyId,
        suggestion.id,
        input.decision === 'DECLINE' ? 'DECLINED' : 'SNOOZED',
        owner.guardianId,
        now,
      );
      if (!decided)
        throw new GraduationDomainError('RESOURCE_STATE_CHANGED', 'Review already resolved.');
      return { suggestion: decided, assignment, graduation: null };
    }
    if (input.expectedVersion === undefined || input.expectedVersion !== assignment.version) {
      throw new GraduationDomainError(
        'STALE_VERSION',
        'Refresh the responsibility before approving graduation.',
      );
    }
    if (assignment.status !== 'ACTIVE')
      throw new GraduationDomainError('RESOURCE_STATE_CHANGED', 'Responsibility is not active.');

    const metrics = calculateActivityProgress(
      await this.activities.listProgressEvidence(owner.familyId, assignment.id, now),
    );
    if (
      !metrics.coverageComplete ||
      metrics.recoveryOpen ||
      metrics.applicableOpportunities === 0
    ) {
      throw new GraduationDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Evidence changed; review cannot be approved until observations are resolved.',
      );
    }

    const updated = await this.repository.transitionAssignment({
      familyId: owner.familyId,
      assignmentId: assignment.id,
      expectedVersion: input.expectedVersion,
      from: 'ACTIVE',
      to: 'GRADUATED',
      now,
    });
    if (!updated)
      throw new GraduationDomainError('STALE_VERSION', 'Responsibility changed on another device.');

    const graduation = await this.repository.createGraduationRecord({
      id: newId<'GraduationRecordId'>(),
      familyId: owner.familyId,
      childId: assignment.childId,
      assignmentId: assignment.id,
      approvedBy: owner.guardianId,
      approvedAt: now,
      monitoringIntervalDays: input.monitoringIntervalDays ?? 14,
    });
    const decided = await this.repository.decideSuggestion(
      owner.familyId,
      suggestion.id,
      'ACCEPTED',
      owner.guardianId,
      now,
    );
    if (!decided)
      throw new GraduationDomainError('RESOURCE_STATE_CHANGED', 'Review already resolved.');
    await this.activities.appendDomainEvent({
      id: newId<'DomainEventId'>() as DomainEventId,
      familyId: owner.familyId,
      type: 'ResponsibilityGraduated',
      aggregateType: 'ActivityAssignment',
      aggregateId: assignment.id,
      occurredAt: input.occurredAt,
      recordedAt: now,
      payload: {
        childId: assignment.childId,
        graduationRecordId: graduation.id,
        monitoringIntervalDays: graduation.monitoringIntervalDays,
      },
    });
    return { suggestion: decided, assignment: updated, graduation };
  }

  async recordObservation(input: {
    actor: ActorContext;
    graduationRecordId: string;
    result: ObservationResult;
    occurredAt: Date;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const owner = guardian(input.actor);
    // The lookup is always family-scoped via the child's assignment and record.
    const graduated = await this.repository.listChildGraduatedForRecord(
      owner.familyId,
      input.graduationRecordId,
    );
    if (!graduated || !(await this.identity.getChild(owner.familyId, graduated.childId))) {
      throw new GraduationDomainError('RESOURCE_NOT_FOUND', 'Graduated responsibility not found.');
    }
    if (
      input.occurredAt < graduated.approvedAt ||
      input.occurredAt > now ||
      (graduated.lastObservedAt && input.occurredAt < graduated.lastObservedAt)
    ) {
      throw new GraduationDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Observation time must follow graduation and prior observations.',
      );
    }
    await this.repository.addObservation({
      id: newId<'GraduationObservationId'>(),
      familyId: owner.familyId,
      graduationRecordId: graduated.id,
      recordedBy: owner.guardianId,
      result: input.result,
      observedAt: input.occurredAt,
      recordedAt: now,
    });
    const observations = await this.repository.listObservations(owner.familyId, graduated.id);
    const state = monitoringState({
      ...graduated,
      lastObservedAt: input.occurredAt,
      observations,
      now,
    });
    let suggestion = null;
    if (state === 'REACTIVATION_REVIEW') {
      suggestion = await this.repository.createSuggestion({
        id: newId<'GraduationSuggestionId'>(),
        familyId: owner.familyId,
        childId: graduated.childId,
        assignmentId: graduated.assignmentId,
        graduationRecordId: graduated.id,
        kind: 'REACTIVATION',
        origin: 'MONITORING_EVIDENCE',
        createdAt: now,
      });
    }
    await this.activities.appendDomainEvent({
      id: newId<'DomainEventId'>() as DomainEventId,
      familyId: owner.familyId,
      type: 'GraduatedResponsibilityObserved',
      aggregateType: 'GraduationRecord',
      aggregateId: graduated.id,
      occurredAt: input.occurredAt,
      recordedAt: now,
      payload: { childId: graduated.childId, result: input.result, monitoringState: state },
    });
    return {
      record: graduated.id,
      monitoringState: state,
      reactivationSuggestionId: suggestion?.id ?? null,
    };
  }

  async decideReactivation(input: {
    actor: ActorContext;
    suggestionId: string;
    decision: 'APPROVE' | 'DECLINE';
    expectedVersion?: number;
    occurredAt: Date;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const { owner, suggestion, assignment } = await this.guardianSuggestion(
      input.actor,
      input.suggestionId,
      'REACTIVATION',
    );
    if (input.decision === 'DECLINE') {
      const decided = await this.repository.decideSuggestion(
        owner.familyId,
        suggestion.id,
        'DECLINED',
        owner.guardianId,
        now,
      );
      if (!decided)
        throw new GraduationDomainError('RESOURCE_STATE_CHANGED', 'Review already resolved.');
      return { suggestion: decided, assignment };
    }
    const record = await this.repository.getActiveGraduation(owner.familyId, assignment.id);
    if (
      !record ||
      record.id !== suggestion.graduationRecordId ||
      assignment.status !== 'GRADUATED'
    ) {
      throw new GraduationDomainError(
        'RESOURCE_STATE_CHANGED',
        'Responsibility is no longer graduated.',
      );
    }
    const observations = await this.repository.listObservations(owner.familyId, record.id);
    if (monitoringState({ ...record, observations, now }) !== 'REACTIVATION_REVIEW') {
      throw new GraduationDomainError(
        'RESOURCE_STATE_CHANGED',
        'Current monitoring evidence no longer supports reactivation review.',
      );
    }
    if (input.expectedVersion === undefined || input.expectedVersion !== assignment.version) {
      throw new GraduationDomainError(
        'STALE_VERSION',
        'Refresh the responsibility before reactivation.',
      );
    }
    const updated = await this.repository.transitionAssignment({
      familyId: owner.familyId,
      assignmentId: assignment.id,
      expectedVersion: input.expectedVersion,
      from: 'GRADUATED',
      to: 'ACTIVE',
      now,
      activeFrom: nextLocalDate(assignment.scheduleTimezone, now),
    });
    if (!updated)
      throw new GraduationDomainError('STALE_VERSION', 'Responsibility changed on another device.');
    if (
      !(await this.repository.reactivateRecord(owner.familyId, record.id, owner.guardianId, now))
    ) {
      throw new GraduationDomainError(
        'RESOURCE_STATE_CHANGED',
        'Graduation record was already closed.',
      );
    }
    const decided = await this.repository.decideSuggestion(
      owner.familyId,
      suggestion.id,
      'ACCEPTED',
      owner.guardianId,
      now,
    );
    if (!decided)
      throw new GraduationDomainError('RESOURCE_STATE_CHANGED', 'Review already resolved.');
    await this.activities.appendDomainEvent({
      id: newId<'DomainEventId'>() as DomainEventId,
      familyId: owner.familyId,
      type: 'ResponsibilityReactivated',
      aggregateType: 'ActivityAssignment',
      aggregateId: assignment.id,
      occurredAt: input.occurredAt,
      recordedAt: now,
      payload: {
        childId: assignment.childId,
        graduationRecordId: record.id,
        resumeOn: updated.activeFrom,
      },
    });
    return { suggestion: decided, assignment: updated };
  }

  async parentOverview(actor: ActorContext, childId: ChildId, now = new Date()) {
    const owner = guardian(actor);
    if (!(await this.identity.getChild(owner.familyId, childId))) {
      throw new GraduationDomainError('RESOURCE_NOT_FOUND', 'Child not found.');
    }
    const assignment = await this.repository.getMakeBedAssignment(owner.familyId, childId);
    if (!assignment) return null;
    const graduated = await this.repository.getActiveGraduation(owner.familyId, assignment.id);
    const observations = graduated
      ? await this.repository.listObservations(owner.familyId, graduated.id)
      : [];
    const suggestion = await this.repository.getPendingSuggestion(
      owner.familyId,
      assignment.id,
      graduated ? 'REACTIVATION' : 'GRADUATION',
    );
    return {
      assignmentId: assignment.id,
      assignmentVersion: assignment.version,
      status: assignment.status,
      suggestionId: suggestion?.id ?? null,
      suggestionKind: suggestion?.kind ?? null,
      suggestionOrigin: suggestion?.origin ?? null,
      graduationRecordId: graduated?.id ?? null,
      monitoringIntervalDays: graduated?.monitoringIntervalDays ?? null,
      monitoringState: graduated ? monitoringState({ ...graduated, observations, now }) : null,
      lastObservedAt: graduated?.lastObservedAt?.toISOString() ?? null,
      graduationApprovedAt: graduated?.approvedAt.toISOString() ?? null,
      observationCount: observations.length,
    };
  }

  async childGraduated(actor: ActorContext) {
    if (actor.kind !== 'CHILD') {
      throw new GraduationDomainError('FORBIDDEN', 'Child session is required.');
    }
    const entries = await this.repository.listChildGraduated(actor.familyId, actor.childId);
    return entries.map((entry) => ({
      id: entry.record.id,
      title: entry.title,
      templateKey: entry.templateKey,
      graduatedAt: entry.record.approvedAt.toISOString(),
    }));
  }
}
