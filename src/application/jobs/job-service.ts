import type { ActorContext } from '@/src/application/auth/actor-context';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import { newId, type ChildId } from '@/src/domain/shared/id';
import {
  jobTransition,
  validateJobPayment,
  JobRuleError,
  type Job,
  type JobStatus,
} from '@/src/domain/jobs/job';
import type { JobRepository } from './job-repository';
import type { MoneyService } from '@/src/application/money/money-service';

export class JobDomainError extends Error {
  constructor(
    readonly code:
      | 'FORBIDDEN'
      | 'RESOURCE_NOT_FOUND'
      | 'STALE_VERSION'
      | 'DOMAIN_RULE_VIOLATION'
      | 'RESOURCE_STATE_CHANGED',
    message: string,
  ) {
    super(message);
    this.name = 'JobDomainError';
  }
}
function requireGuardian(actor: ActorContext) {
  if (actor.kind !== 'GUARDIAN')
    throw new JobDomainError('FORBIDDEN', 'Guardian authorization required.');
  return actor;
}
export class JobService {
  constructor(
    private readonly repository: JobRepository,
    private readonly identity: IdentityRepository,
    private readonly money: MoneyService,
  ) {}

  async create(
    actor: ActorContext,
    input: { childId: string; title: string; criteria: string; paymentMinor: string; now: Date },
  ) {
    const guardian = requireGuardian(actor);
    const child = await this.identity.getChild(guardian.familyId, input.childId as ChildId);
    const family = await this.identity.getFamily(guardian.familyId);
    if (!child || !family) throw new JobDomainError('RESOURCE_NOT_FOUND', 'Child not found.');
    try {
      validateJobPayment(input.paymentMinor);
    } catch (e) {
      if (e instanceof JobRuleError) throw new JobDomainError('DOMAIN_RULE_VIOLATION', e.message);
      throw e;
    }
    const job: Job = {
      id: newId<'JobId'>(),
      familyId: guardian.familyId,
      childId: input.childId,
      title: input.title.trim(),
      criteria: input.criteria.trim(),
      paymentMinor: input.paymentMinor,
      currency: family.currency,
      status: 'OFFERED',
      termsVersion: 1,
      acceptedTermsVersion: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    };
    await this.repository.create(job);
    return job;
  }
  private async locked(actor: ActorContext, jobId: string, version: number | undefined) {
    if (actor.kind === 'SYSTEM') throw new JobDomainError('FORBIDDEN', 'Family context required.');
    const job = await this.repository.lock(actor.familyId, jobId);
    if (!job || (actor.kind === 'CHILD' && job.childId !== actor.childId))
      throw new JobDomainError('RESOURCE_NOT_FOUND', 'Job not found.');
    if (version === undefined || version !== job.version)
      throw new JobDomainError(
        'STALE_VERSION',
        'Job terms or status changed. Refresh before proceeding.',
      );
    return job;
  }
  async action(
    actor: ActorContext,
    input: {
      jobId: string;
      action:
        | 'ACCEPT'
        | 'START'
        | 'SUBMIT'
        | 'REQUEST_REVISION'
        | 'RESTART'
        | 'APPROVE'
        | 'CREDIT'
        | 'CANCEL';
      expectedVersion?: number | undefined;
      occurredAt: Date;
      now: Date;
    },
  ) {
    if (
      input.action === 'ACCEPT' ||
      input.action === 'START' ||
      input.action === 'SUBMIT' ||
      input.action === 'RESTART'
    ) {
      if (actor.kind !== 'CHILD')
        throw new JobDomainError('FORBIDDEN', 'Only the assigned child can accept or submit work.');
    } else requireGuardian(actor);
    const job = await this.locked(actor, input.jobId, input.expectedVersion);
    let next: JobStatus;
    try {
      next = jobTransition(job, input.action);
    } catch (e) {
      if (e instanceof JobRuleError) throw new JobDomainError('RESOURCE_STATE_CHANGED', e.message);
      throw e;
    }
    if (
      input.action === 'CANCEL' &&
      ['IN_PROGRESS', 'SUBMITTED', 'NEEDS_REVISION'].includes(job.status)
    )
      next = 'CANCELLED_WITH_WORK';
    // APPROVE records a debt (AWAITING_CREDIT); only CREDIT writes money.
    if (input.action === 'CREDIT') {
      await this.money.creditJob(actor, {
        childId: job.childId,
        jobId: job.id,
        amountMinor: job.paymentMinor,
        occurredAt: input.occurredAt,
        now: input.now,
      });
    }
    const updated = await this.repository.update({
      familyId: job.familyId,
      id: job.id,
      expectedVersion: job.version,
      patch: {
        status: next,
        ...(input.action === 'ACCEPT' ? { acceptedTermsVersion: job.termsVersion } : {}),
      },
      now: input.now,
    });
    if (!updated) throw new JobDomainError('STALE_VERSION', 'Job changed on another device.');
    return updated;
  }
  async revise(
    actor: ActorContext,
    input: {
      jobId: string;
      criteria: string;
      paymentMinor: string;
      reason: string;
      expectedVersion?: number | undefined;
      now: Date;
    },
  ) {
    requireGuardian(actor);
    const job = await this.locked(actor, input.jobId, input.expectedVersion);
    if (!['OFFERED', 'ACCEPTED', 'NEEDS_REVISION'].includes(job.status))
      throw new JobDomainError(
        'RESOURCE_STATE_CHANGED',
        'Work already in progress or submitted; no unilateral payment changes.',
      );
    try {
      validateJobPayment(input.paymentMinor);
    } catch (e) {
      if (e instanceof JobRuleError) throw new JobDomainError('DOMAIN_RULE_VIOLATION', e.message);
      throw e;
    }
    const termsVersion = job.termsVersion + 1;
    // A revision invalidates prior acceptance and returns to OFFERED.
    await this.repository.recordRevision({
      id: newId<'JobRevisionId'>(),
      familyId: job.familyId,
      jobId: job.id,
      termsVersion,
      criteria: input.criteria.trim(),
      paymentMinor: input.paymentMinor,
      reason: input.reason.trim(),
      now: input.now,
    });
    const updated = await this.repository.update({
      familyId: job.familyId,
      id: job.id,
      expectedVersion: job.version,
      now: input.now,
      patch: {
        criteria: input.criteria.trim(),
        paymentMinor: input.paymentMinor,
        termsVersion,
        acceptedTermsVersion: null,
        status: 'OFFERED',
      },
    });
    if (!updated) throw new JobDomainError('STALE_VERSION', 'Job changed on another device.');
    return updated;
  }
  async listVisible(actor: ActorContext, childId?: string) {
    if (actor.kind === 'SYSTEM') throw new JobDomainError('FORBIDDEN', 'Family session required.');
    if (actor.kind === 'CHILD') return this.repository.listChild(actor.familyId, actor.childId);
    return childId
      ? this.repository.listChild(actor.familyId, childId)
      : this.repository.listFamily(actor.familyId);
  }
}
