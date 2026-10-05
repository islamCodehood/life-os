import type { ActorContext } from '@/src/application/auth/actor-context';
import { AuthorizationService } from '@/src/application/identity/authorization-service';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import type { ActivityRepository } from './activity-repository';
import type {
  ActivityAssignment,
  ActivityDefinition,
  ActivityInstance,
  ActivityInstanceStatus,
  CompletionRecord,
} from '@/src/domain/activity/entities';
import { resolveActivityPolicy } from '@/src/domain/activity/policy';
import {
  buildDailyOpportunityWindow,
  initialDailyActiveDate,
  localDateInTimezone,
  localDayBoundsUtc,
} from '@/src/domain/activity/schedule';
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
  templateKey: 'SELF_MAKE_BED' | null;
  title: string;
  why: string | null;
  scheduleLabel: string;
  status: 'pending' | 'completed' | 'missed' | 'unresolved';
  version: number;
  targetAt: string;
  availableFrom: string;
  opportunityEndsAt: string;
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
  ) {
    this.authorization = authorization ?? new AuthorizationService(identityRepository);
  }

  async assignMakeBed(actor: ActorContext, childId: ChildId, now = new Date()) {
    const guardian = requireGuardian(actor);
    const child = await this.identityRepository.getChild(guardian.familyId, childId);
    if (!child) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Child profile was not found.');
    }

    const existing = await this.repository.findActiveAssignmentByTemplate(
      guardian.familyId,
      childId,
      'SELF_MAKE_BED',
    );
    if (existing) {
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
    if (template.category !== 'SELF_RESPONSIBILITY' || template.defaultScheduleRrule !== 'FREQ=DAILY') {
      throw new ActivityDomainError(
        'DOMAIN_RULE_VIOLATION',
        'Make Bed template does not match the E2 responsibility contract.',
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
      reminderPolicy: {},
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

    return { families: families.length, materialized };
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

    return {
      date,
      timezone: family.timezone,
      sections: [
        {
          key: 'responsibilities',
          title: 'Today',
          items: contexts.map(({ instance, assignment, definition }) => ({
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
          })),
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

    const allowed = await this.authorization.canCompleteActivity(input.actor, context.instance.childId);
    if (!allowed) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Activity opportunity was not found.');
    }

    if (context.instance.status === 'COMPLETED') {
      const existing = await this.repository.getCompletion(
        familyId,
        context.instance.id,
      );
      if (!existing) {
        throw new ActivityDomainError(
          'RESOURCE_STATE_CHANGED',
          'Completed activity is missing its canonical completion record.',
        );
      }
      return { instance: context.instance, completion: existing, alreadyCompleted: true };
    }

    if (context.instance.status !== 'PENDING') {
      throw new ActivityDomainError(
        'RESOURCE_STATE_CHANGED',
        'This activity opportunity can no longer be completed.',
      );
    }

    if (
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

    const completion: CompletionRecord = {
      id: newId<'CompletionRecordId'>() as CompletionRecordId,
      familyId: familyId,
      activityInstanceId: context.instance.id,
      occurredAt: input.occurredAt,
      recordedAt,
      reportedByKind: input.actor.kind === 'CHILD' ? 'CHILD' : 'GUARDIAN',
      reportedById:
        input.actor.kind === 'CHILD'
          ? input.actor.childId
          : input.actor.kind === 'GUARDIAN'
            ? input.actor.guardianId
            : null,
      selfInitiated: input.actor.kind === 'CHILD',
      reminderCountAtCompletion: 0,
      source: input.actor.kind === 'CHILD' ? 'CHILD_SELF' : 'GUARDIAN',
    };

    await this.repository.appendCompletion(completion);
    const updated = await this.repository.markInstanceCompleted(
      familyId,
      context.instance.id,
      context.instance.version,
      recordedAt,
    );
    if (!updated) {
      throw new ActivityDomainError('STALE_VERSION', 'This activity changed on another device.');
    }

    await this.repository.appendDomainEvent({
      id: newId<'DomainEventId'>() as DomainEventId,
      familyId: familyId,
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
      },
    });

    return { instance: updated, completion, alreadyCompleted: false };
  }

  async getParentHistory(actor: ActorContext, childId: ChildId, limit = 10) {
    const guardian = requireGuardian(actor);
    if (!(await this.authorization.canManageActivity(guardian, childId))) {
      throw new ActivityDomainError('RESOURCE_NOT_FOUND', 'Child profile was not found.');
    }
    return this.repository.listCompletionHistory(guardian.familyId, childId, limit);
  }

  private async materializeAssignmentForDate(assignment: ActivityAssignment, date: string) {
    const window = buildDailyOpportunityWindow({
      date,
      timezone: assignment.scheduleTimezone,
      localTargetTime: assignment.localTargetTime,
      availableOffsetMinutes: assignment.availableOffsetMinutes,
      opportunityEndOffsetMinutes: assignment.opportunityEndOffsetMinutes,
    });

    return this.repository.ensureInstance({
      id: newId<'ActivityInstanceId'>() as ActivityInstanceId,
      familyId: assignment.familyId,
      childId: assignment.childId,
      assignmentId: assignment.id,
      ...window,
      status: 'PENDING',
      version: 1,
    });
  }
}
