import type { ActorContext } from '@/src/application/auth/actor-context';
import { AuthorizationService } from '@/src/application/identity/authorization-service';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import type { ActivityRepository } from './activity-repository';
import type {
  ActivityAssignment,
  ActivityTemplateKey,
  ActivityDefinition,
  ActivityInstance,
  ActivityInstanceStatus,
  CompletionRecord,
  ReminderRecord,
} from '@/src/domain/activity/entities';
import { resolveActivityPolicy } from '@/src/domain/activity/policy';
import {
  awardForCompletion,
  growthTemplateConfig,
  isGrowthTemplate,
  skillProgressFromLedger,
  type GrowthTemplateKey,
} from '@/src/domain/growth/skill-xp';
import type { XpRepository } from '@/src/application/growth/xp-repository';
import {
  calculateActivityProgress,
  recoveryLatencyForCompletion,
  type ActivityProgressMetrics,
} from '@/src/domain/activity/progress';
import {
  classifyCompletionReminderEvidence,
  defaultActivityReminderPolicy,
  scheduledSystemReminderAt,
} from '@/src/domain/activity/reminder';
import {
  buildDailyOpportunityWindow,
  initialDailyActiveDate,
  localDateInTimezone,
  localDayBoundsUtc,
} from '@/src/domain/activity/schedule';
import { deriveAgeProfile } from '@/src/domain/identity/experience';
import { newId } from '@/src/domain/shared/id';
import type {
  ActivityAssignmentId,
  ActivityDefinitionId,
  ActivityInstanceId,
  ChildId,
  CompletionRecordId,
  DomainEventId,
  FamilyId,
  GuardianId,
  ReminderRecordId,
} from '@/src/domain/shared/id';

export class ActivityDomainError extends Error {
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
    this.name = 'ActivityDomainError';
  }
}

export interface ActivityCardDto {
  id: ActivityInstanceId;
  templateKey: ActivityTemplateKey | null;
  title: string;
  why: string | null;
  scheduleLabel: string;
  status: 'pending' | 'completed' | 'missed' | 'unresolved';
  version: number;
  targetAt: string;
  availableFrom: string;
  opportunityEndsAt: string;
  recoveryRecognition: boolean;
}

export interface ChildTodayDto {
  date: string;
  timezone: string;
  sections: Array<{
    key: string;
    title: string;
    items: ActivityCardDto[];
  }>;
  pendingJobs: number;
  generatedAt: string;
}

export interface ParentMakeBedInsightDto {
  assignmentId: ActivityAssignmentId;
  metrics: ActivityProgressMetrics;
  unresolved: Array<{
    id: ActivityInstanceId;
    version: number;
    targetAt: string;
  }>;
}

function requireGuardian(actor: ActorContext): Extract<ActorContext, { kind: 'GUARDIAN' }> {
  if (actor.kind !== 'GUARDIAN') {
    throw new ActivityDomainError('FORBIDDEN', 'Guardian permission is required.');
  }
  return actor;
}

function cardStatus(status: ActivityInstanceStatus): ActivityCardDto['status'] {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'MISSED') return 'missed';
  if (status === 'AWAITING_RESOLUTION') return 'unresolved';
  return 'pending';
}

export class ActivityService {
  private readonly authorization: AuthorizationService;

  constructor(
    private readonly repository: ActivityRepository,
    private readonly identityRepository: IdentityRepository,
    authorization?: AuthorizationService,
    private readonly xpRepository?: XpRepository,
  ) {
    this.authorization = authorization ?? new AuthorizationService(identityRepository);
  }

  async assignMakeBed(actor: ActorContext, childId: ChildId, now = new Date()) {
    const guardian = requireGuardian(actor);
    const child = await this.identityRepository.getChild(guardian.familyId, childId);
    if (!child) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Child profile was not found.');
    }

    const existing = await this.repository.findAssignedByTemplate(
      guardian.familyId,
      childId,
      'SELF_MAKE_BED',
    );
    if (existing) {
      if (existing.status === 'GRADUATED') {
        throw new ActivityDomainError(
          'RESOURCE_STATE_CHANGED',
          'This responsibility is graduated; guardian reactivation is required before daily tracking resumes.',
        );
      }
      const instance = await this.materializeAssignmentForDate(existing, existing.activeFrom);
      return { assignment: existing, instance, created: false };
    }

    const family = await this.identityRepository.getFamily(guardian.familyId);
    if (!family) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Family was not found.');
    }

    const template = await this.repository.getTemplate('SELF_MAKE_BED');
    if (!template) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Make Bed template was not seeded.');
    }
    if (
      template.category !== 'SELF_RESPONSIBILITY' ||
      template.defaultScheduleRrule !== 'FREQ=DAILY'
    ) {
      throw new ActivityDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Make Bed template does not match the responsibility contract.',
      );
    }

    const policy = resolveActivityPolicy(template.category);
    if (policy.money !== 'FORBIDDEN') {
      throw new ActivityDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Ordinary self responsibilities cannot produce money.',
      );
    }

    const definition: ActivityDefinition = {
      id: newId<'ActivityDefinitionId'>() as ActivityDefinitionId,
      familyId: guardian.familyId,
      templateKey: template.key,
      title: template.title,
      description: template.description,
      why: template.why,
      category: template.category,
      createdByGuardianId: guardian.guardianId as GuardianId,
      version: 1,
      archivedAt: null,
    };
    await this.repository.createDefinition(definition);

    const activeFrom = initialDailyActiveDate({
      now,
      timezone: family.timezone,
      localTargetTime: template.defaultLocalTargetTime,
      availableOffsetMinutes: template.defaultAvailableOffsetMinutes,
    });
    const ageProfile = deriveAgeProfile(child.birthDate, activeFrom);

    const assignment: ActivityAssignment = {
      id: newId<'ActivityAssignmentId'>() as ActivityAssignmentId,
      familyId: guardian.familyId,
      childId,
      activityDefinitionId: definition.id,
      status: 'ACTIVE',
      scheduleRrule: 'FREQ=DAILY',
      scheduleTimezone: family.timezone,
      localTargetTime: template.defaultLocalTargetTime,
      availableOffsetMinutes: template.defaultAvailableOffsetMinutes,
      opportunityEndOffsetMinutes: template.defaultOpportunityEndOffsetMinutes,
      trackingMode: template.defaultTrackingMode,
      completionMode: template.defaultCompletionMode,
      approvalMode: policy.approvalDefault,
      progressMode: policy.progressMode,
      xpMode: policy.xp,
      xpAmount: null,
      reminderPolicy: defaultActivityReminderPolicy(ageProfile),
      activeFrom,
      activeUntil: null,
      version: 1,
      archivedAt: null,
    };
    await this.repository.createAssignment(assignment);

    const instance = await this.materializeAssignmentForDate(assignment, activeFrom);
    return { assignment, instance, created: true };
  }

  async assignGrowthPractice(
    actor: ActorContext,
    childId: ChildId,
    templateKey: GrowthTemplateKey,
    now = new Date(),
  ) {
    const guardian = requireGuardian(actor);
    const child = await this.identityRepository.getChild(guardian.familyId, childId);
    if (!child) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Child profile was not found.');
    }

    const existing = await this.repository.findAssignedByTemplate(
      guardian.familyId,
      childId,
      templateKey,
    );
    if (existing) {
      if (existing.status === 'GRADUATED') {
        throw new ActivityDomainError(
          'RESOURCE_STATE_CHANGED',
          'This responsibility is graduated; guardian reactivation is required before daily tracking resumes.',
        );
      }
      const instance = await this.materializeAssignmentForDate(existing, existing.activeFrom);
      return { assignment: existing, instance, created: false };
    }

    const family = await this.identityRepository.getFamily(guardian.familyId);
    if (!family) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Family was not found.');
    }

    const template = await this.repository.getTemplate(templateKey);
    if (!template) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Growth template was not seeded.');
    }
    if (template.category !== 'GROWTH' || template.defaultScheduleRrule !== 'FREQ=DAILY') {
      throw new ActivityDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Growth template does not match growth practice policy.',
      );
    }

    const policy = resolveActivityPolicy(template.category);
    if (policy.money !== 'FORBIDDEN' || policy.xp !== 'ALLOWED') {
      throw new ActivityDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Growth practice policy must allow skill XP and forbid money.',
      );
    }

    const definition: ActivityDefinition = {
      id: newId<'ActivityDefinitionId'>() as ActivityDefinitionId,
      familyId: guardian.familyId,
      templateKey: template.key,
      title: template.title,
      description: template.description,
      why: template.why,
      category: template.category,
      createdByGuardianId: guardian.guardianId as GuardianId,
      version: 1,
      archivedAt: null,
    };
    await this.repository.createDefinition(definition);

    const activeFrom = initialDailyActiveDate({
      now,
      timezone: family.timezone,
      localTargetTime: template.defaultLocalTargetTime,
      availableOffsetMinutes: template.defaultAvailableOffsetMinutes,
    });

    const assignment: ActivityAssignment = {
      id: newId<'ActivityAssignmentId'>() as ActivityAssignmentId,
      familyId: guardian.familyId,
      childId,
      activityDefinitionId: definition.id,
      status: 'ACTIVE',
      scheduleRrule: 'FREQ=DAILY',
      scheduleTimezone: family.timezone,
      localTargetTime: template.defaultLocalTargetTime,
      availableOffsetMinutes: template.defaultAvailableOffsetMinutes,
      opportunityEndOffsetMinutes: template.defaultOpportunityEndOffsetMinutes,
      trackingMode: template.defaultTrackingMode,
      completionMode: template.defaultCompletionMode,
      approvalMode: policy.approvalDefault,
      progressMode: policy.progressMode,
      xpMode: policy.xp,
      xpAmount: growthTemplateConfig(templateKey).xpPerOpportunity,
      reminderPolicy: { systemReminderOffsetMinutes: null },
      activeFrom,
      activeUntil: null,
      version: 1,
      archivedAt: null,
    };
    await this.repository.createAssignment(assignment);

    const instance = await this.materializeAssignmentForDate(assignment, activeFrom);
    return { assignment, instance, created: true };
  }

  async materializeFamilyDate(familyId: FamilyId, date: string) {
    const assignments = await this.repository.listActiveAssignmentsForFamily(familyId);
    const instances: ActivityInstance[] = [];

    for (const assignment of assignments) {
      if (assignment.scheduleRrule !== 'FREQ=DAILY') continue;
      if (date < assignment.activeFrom) continue;
      if (assignment.activeUntil && date > assignment.activeUntil) continue;
      instances.push(await this.materializeAssignmentForDate(assignment, date));
    }

    return instances;
  }

  async materializeCurrentForAllFamilies(now = new Date()) {
    const families = await this.repository.listSchedulingFamilies();
    let materialized = 0;

    for (const family of families) {
      const date = localDateInTimezone(family.timezone, now);
      materialized += (await this.materializeFamilyDate(family.familyId, date)).length;
    }

    const awaitingResolution = await this.repository.markExpiredPendingAwaitingResolution(now);
    return { families: families.length, materialized, awaitingResolution };
  }

  async getChildToday(actor: ActorContext, now = new Date()): Promise<ChildTodayDto> {
    if (actor.kind !== 'CHILD') {
      throw new ActivityDomainError('FORBIDDEN', 'Child session is required.');
    }

    const family = await this.identityRepository.getFamily(actor.familyId);
    if (!family) throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Family was not found.');

    const date = localDateInTimezone(family.timezone, now);
    const { start, end } = localDayBoundsUtc(date, family.timezone);
    const contexts = await this.repository.listChildInstancesBetween(
      actor.familyId,
      actor.childId,
      start,
      end,
    );

    const items: ActivityCardDto[] = [];
    for (const { instance, assignment, definition } of contexts) {
      if (assignment.status !== 'ACTIVE' || date < assignment.activeFrom) continue;
      if (instance.status === 'EXCUSED' || instance.status === 'NOT_APPLICABLE') continue;

      let recoveryRecognition = false;
      if (instance.status === 'COMPLETED') {
        const evidence = await this.repository.listProgressEvidence(
          actor.familyId,
          assignment.id,
          now,
        );
        recoveryRecognition = recoveryLatencyForCompletion(evidence, instance.id) !== null;
      }

      items.push({
        id: instance.id,
        templateKey: definition.templateKey,
        title: definition.title,
        why: definition.why,
        scheduleLabel: assignment.localTargetTime,
        status: cardStatus(instance.status),
        version: instance.version,
        targetAt: instance.targetAt.toISOString(),
        availableFrom: instance.availableFrom.toISOString(),
        opportunityEndsAt: instance.opportunityEndsAt.toISOString(),
        recoveryRecognition,
      });
    }

    return {
      date,
      timezone: family.timezone,
      sections: [
        {
          key: 'responsibilities',
          title: 'Today',
          items,
        },
      ],
      pendingJobs: 0,
      generatedAt: now.toISOString(),
    };
  }

  async completeActivity(input: {
    actor: ActorContext;
    instanceId: ActivityInstanceId;
    occurredAt: Date;
    recordedAt?: Date;
    expectedVersion?: number;
  }) {
    if (input.actor.kind === 'SYSTEM' || !input.actor.familyId) {
      throw new ActivityDomainError('FORBIDDEN', 'A family actor is required.');
    }

    const familyId = input.actor.familyId;
    const recordedAt = input.recordedAt ?? new Date();
    const context = await this.repository.getInstanceForUpdate(familyId, input.instanceId);

    if (!context) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Activity opportunity was not found.');
    }

    const allowed = await this.authorization.canCompleteActivity(
      input.actor,
      context.instance.childId,
    );
    if (!allowed) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Activity opportunity was not found.');
    }

    if (context.assignment.status !== 'ACTIVE') {
      throw new ActivityDomainError(
        'RESOURCE_STATE_CHANGED',
        'This responsibility is no longer in daily tracking.',
      );
    }

    if (context.instance.status === 'COMPLETED') {
      const existing = await this.repository.getCompletion(familyId, context.instance.id);
      if (!existing) {
        throw new ActivityDomainError(
          'RESOURCE_STATE_CHANGED',
          'Completed activity is missing its canonical completion record.',
        );
      }
      return { instance: context.instance, completion: existing, alreadyCompleted: true };
    }

    if (
      context.instance.status !== 'PENDING' &&
      context.instance.status !== 'AWAITING_RESOLUTION'
    ) {
      throw new ActivityDomainError(
        'RESOURCE_STATE_CHANGED',
        'This activity opportunity can no longer be completed.',
      );
    }

    if (
      context.instance.status === 'PENDING' &&
      input.expectedVersion !== undefined &&
      input.expectedVersion !== context.instance.version
    ) {
      throw new ActivityDomainError('STALE_VERSION', 'This activity changed on another device.');
    }

    if (
      input.occurredAt < context.instance.availableFrom ||
      input.occurredAt > context.instance.opportunityEndsAt
    ) {
      throw new ActivityDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Completion time is outside this activity opportunity.',
      );
    }

    const reminders = await this.repository.listRemindersForInstance(familyId, context.instance.id);
    const reporter = input.actor.kind === 'CHILD' ? 'CHILD' : 'GUARDIAN';
    const reminderEvidence = classifyCompletionReminderEvidence({
      reporter,
      occurredAt: input.occurredAt,
      reminders,
    });

    const completion: CompletionRecord = {
      id: newId<'CompletionRecordId'>() as CompletionRecordId,
      familyId,
      activityInstanceId: context.instance.id,
      occurredAt: input.occurredAt,
      recordedAt,
      reportedByKind: reporter,
      reportedById:
        input.actor.kind === 'CHILD'
          ? input.actor.childId
          : input.actor.kind === 'GUARDIAN'
            ? input.actor.guardianId
            : null,
      selfInitiated: reminderEvidence.selfInitiated,
      reminderCountAtCompletion: reminderEvidence.reminderCountAtCompletion,
      source: input.actor.kind === 'CHILD' ? 'CHILD_SELF' : 'GUARDIAN',
    };

    await this.repository.appendCompletion(completion);
    const updated = await this.repository.markInstanceCompleted(
      familyId,
      context.instance.id,
      context.instance.version,
      recordedAt,
      [context.instance.status],
    );
    if (!updated) {
      throw new ActivityDomainError('STALE_VERSION', 'This activity changed on another device.');
    }

    const completionEventId = newId<'DomainEventId'>() as DomainEventId;
    await this.repository.appendDomainEvent({
      id: completionEventId,
      familyId,
      type: 'ActivityCompleted',
      aggregateType: 'ActivityInstance',
      aggregateId: updated.id,
      occurredAt: input.occurredAt,
      recordedAt,
      payload: {
        activityInstanceId: updated.id,
        childId: updated.childId,
        source: completion.source,
        selfInitiated: completion.selfInitiated,
        reminderCountAtCompletion: completion.reminderCountAtCompletion,
        externalReminderCountAtCompletion: reminderEvidence.externalReminderCountAtCompletion,
      },
    });

    const xpAward = awardForCompletion({
      templateKey: context.definition.templateKey,
      category: context.definition.category,
      xpMode: context.assignment.xpMode,
      xpAmount: context.assignment.xpAmount,
    });
    if (xpAward) {
      if (!this.xpRepository)
        throw new ActivityDomainError('DOMAIN_RULE_VIOLATION', 'XP ledger is not configured.');
      await this.xpRepository.append({
        id: newId<'XpEntryId'>(),
        familyId,
        childId: context.instance.childId,
        skillKey: xpAward.skillKey,
        entryType: 'GRANT',
        amount: xpAward.amount,
        sourceEventId: completionEventId,
        correctionOf: null,
        correctionReason: null,
        occurredAt: input.occurredAt,
        recordedAt,
      });
    }

    return { instance: updated, completion, alreadyCompleted: false, xpAward: xpAward ?? null };
  }

  async markActivityMissed(input: {
    actor: ActorContext;
    instanceId: ActivityInstanceId;
    occurredAt?: Date;
    recordedAt?: Date;
    expectedVersion?: number;
  }) {
    const guardian = requireGuardian(input.actor);
    const recordedAt = input.recordedAt ?? new Date();
    const occurredAt = input.occurredAt ?? recordedAt;
    const context = await this.repository.getInstanceForUpdate(guardian.familyId, input.instanceId);

    if (
      !context ||
      !(await this.authorization.canManageActivity(guardian, context.instance.childId))
    ) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Activity opportunity was not found.');
    }
    if (context.instance.status !== 'AWAITING_RESOLUTION') {
      throw new ActivityDomainError(
        'RESOURCE_STATE_CHANGED',
        'Only an unresolved activity opportunity can be confirmed missed.',
      );
    }
    if (input.expectedVersion !== undefined && input.expectedVersion !== context.instance.version) {
      throw new ActivityDomainError('STALE_VERSION', 'This activity changed on another device.');
    }

    const updated = await this.repository.updateInstanceStatus(
      guardian.familyId,
      context.instance.id,
      context.instance.version,
      ['AWAITING_RESOLUTION'],
      'MISSED',
      recordedAt,
    );
    if (!updated) {
      throw new ActivityDomainError('STALE_VERSION', 'This activity changed on another device.');
    }

    await this.repository.appendDomainEvent({
      id: newId<'DomainEventId'>() as DomainEventId,
      familyId: guardian.familyId,
      type: 'ActivityMissed',
      aggregateType: 'ActivityInstance',
      aggregateId: updated.id,
      occurredAt,
      recordedAt,
      payload: {
        activityInstanceId: updated.id,
        childId: updated.childId,
      },
    });

    return updated;
  }

  async excuseActivity(input: {
    actor: ActorContext;
    instanceId: ActivityInstanceId;
    occurredAt?: Date;
    recordedAt?: Date;
    expectedVersion?: number;
  }) {
    const guardian = requireGuardian(input.actor);
    const recordedAt = input.recordedAt ?? new Date();
    const occurredAt = input.occurredAt ?? recordedAt;
    const context = await this.repository.getInstanceForUpdate(guardian.familyId, input.instanceId);

    if (
      !context ||
      !(await this.authorization.canManageActivity(guardian, context.instance.childId))
    ) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Activity opportunity was not found.');
    }
    if (
      context.instance.status !== 'PENDING' &&
      context.instance.status !== 'AWAITING_RESOLUTION'
    ) {
      throw new ActivityDomainError(
        'RESOURCE_STATE_CHANGED',
        'This activity opportunity can no longer be excused.',
      );
    }
    if (input.expectedVersion !== undefined && input.expectedVersion !== context.instance.version) {
      throw new ActivityDomainError('STALE_VERSION', 'This activity changed on another device.');
    }

    const updated = await this.repository.updateInstanceStatus(
      guardian.familyId,
      context.instance.id,
      context.instance.version,
      [context.instance.status],
      'EXCUSED',
      recordedAt,
    );
    if (!updated) {
      throw new ActivityDomainError('STALE_VERSION', 'This activity changed on another device.');
    }

    await this.repository.appendDomainEvent({
      id: newId<'DomainEventId'>() as DomainEventId,
      familyId: guardian.familyId,
      type: 'ActivityExcused',
      aggregateType: 'ActivityInstance',
      aggregateId: updated.id,
      occurredAt,
      recordedAt,
      payload: {
        activityInstanceId: updated.id,
        childId: updated.childId,
      },
    });

    return updated;
  }

  async getChildSkillProgress(actor: ActorContext, childId: ChildId) {
    if (actor.kind === 'SYSTEM' || (actor.kind === 'CHILD' && actor.childId !== childId)) {
      throw new ActivityDomainError('FORBIDDEN', 'Access denied.');
    }
    if (!(await this.identityRepository.getChild(actor.familyId, childId))) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Child was not found.');
    }
    if (!this.xpRepository)
      throw new ActivityDomainError('DOMAIN_RULE_VIOLATION', 'XP ledger is not configured.');
    return skillProgressFromLedger(
      await this.xpRepository.listChildEntries(actor.familyId, childId),
    );
  }

  async getParentXpHistory(actor: ActorContext, childId: ChildId) {
    const owner = requireGuardian(actor);
    if (!(await this.authorization.canManageActivity(owner, childId))) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Child was not found.');
    }
    if (!this.xpRepository)
      throw new ActivityDomainError('DOMAIN_RULE_VIOLATION', 'XP ledger is not configured.');
    return this.xpRepository.listChildEntries(owner.familyId, childId);
  }

  async correctXpGrant(input: {
    actor: ActorContext;
    xpEntryId: string;
    reason: string;
    occurredAt: Date;
    recordedAt?: Date;
  }) {
    const owner = requireGuardian(input.actor);
    const recordedAt = input.recordedAt ?? new Date();
    if (!this.xpRepository)
      throw new ActivityDomainError('DOMAIN_RULE_VIOLATION', 'XP ledger is not configured.');
    const original = await this.xpRepository.getEntry(owner.familyId, input.xpEntryId);
    if (!original) throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'XP grant was not found.');
    if (!(await this.authorization.canManageActivity(owner, original.childId as ChildId))) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'XP grant was not found.');
    }
    if (
      original.entryType !== 'GRANT' ||
      original.amount <= 0 ||
      (await this.xpRepository.hasCorrection(owner.familyId, original.id))
    ) {
      throw new ActivityDomainError(
        'RESOURCE_STATE_CHANGED',
        'This is not an uncorrected XP grant.',
      );
    }
    const reason = input.reason.trim();
    if (reason.length < 5)
      throw new ActivityDomainError(
        'DOMAIN_RULE_VIOLATION',
        'A meaningful correction reason is required.',
      );
    const sourceEventId = newId<'DomainEventId'>() as DomainEventId;
    await this.repository.appendDomainEvent({
      id: sourceEventId,
      familyId: owner.familyId,
      type: 'XpGrantCorrected',
      aggregateType: 'XpLedgerEntry',
      aggregateId: original.id,
      occurredAt: input.occurredAt,
      recordedAt,
      payload: { childId: original.childId, originalEntryId: original.id, reason },
    });
    await this.xpRepository.append({
      id: newId<'XpEntryId'>(),
      familyId: owner.familyId,
      childId: original.childId,
      skillKey: original.skillKey,
      entryType: 'CORRECTION',
      amount: -original.amount,
      sourceEventId,
      correctionOf: original.id,
      correctionReason: reason,
      occurredAt: input.occurredAt,
      recordedAt,
    });
    return {
      correctedEntryId: original.id,
      skillKey: original.skillKey,
      reversedAmount: original.amount,
    };
  }

  async getParentHistory(actor: ActorContext, childId: ChildId, limit = 10) {
    const guardian = requireGuardian(actor);
    if (!(await this.authorization.canManageActivity(guardian, childId))) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Child profile was not found.');
    }
    return this.repository.listCompletionHistory(guardian.familyId, childId, limit);
  }

  async getParentMakeBedInsight(
    actor: ActorContext,
    childId: ChildId,
    now = new Date(),
  ): Promise<ParentMakeBedInsightDto | null> {
    const guardian = requireGuardian(actor);
    if (!(await this.authorization.canManageActivity(guardian, childId))) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Child profile was not found.');
    }

    const assignment = await this.repository.findActiveAssignmentByTemplate(
      guardian.familyId,
      childId,
      'SELF_MAKE_BED',
    );
    if (!assignment) return null;

    const evidence = await this.repository.listProgressEvidence(
      guardian.familyId,
      assignment.id,
      now,
    );

    return {
      assignmentId: assignment.id,
      metrics: calculateActivityProgress(evidence),
      unresolved: evidence
        .filter((opportunity) => opportunity.status === 'AWAITING_RESOLUTION')
        .map((opportunity) => ({
          id: opportunity.instanceId as ActivityInstanceId,
          version: opportunity.version,
          targetAt: opportunity.targetAt.toISOString(),
        })),
    };
  }

  private async materializeAssignmentForDate(assignment: ActivityAssignment, date: string) {
    const window = buildDailyOpportunityWindow({
      date,
      timezone: assignment.scheduleTimezone,
      localTargetTime: assignment.localTargetTime,
      availableOffsetMinutes: assignment.availableOffsetMinutes,
      opportunityEndOffsetMinutes: assignment.opportunityEndOffsetMinutes,
    });

    const instance = await this.repository.ensureInstance({
      id: newId<'ActivityInstanceId'>() as ActivityInstanceId,
      familyId: assignment.familyId,
      childId: assignment.childId,
      assignmentId: assignment.id,
      ...window,
      status: 'PENDING',
      version: 1,
    });

    const scheduledFor = scheduledSystemReminderAt(instance.targetAt, assignment.reminderPolicy);
    if (scheduledFor) {
      const reminder: ReminderRecord = {
        id: newId<'ReminderRecordId'>() as ReminderRecordId,
        familyId: instance.familyId,
        activityInstanceId: instance.id,
        source: 'SYSTEM',
        kind: 'ACTIVITY',
        scheduledFor,
        attemptedAt: null,
        deliveredAt: null,
        acknowledgedAt: null,
      };
      await this.repository.ensureReminder(reminder);
    }

    return instance;
  }
}
