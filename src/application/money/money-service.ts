import type { ActorContext } from '@/src/application/auth/actor-context';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import { newId, type ChildId } from '@/src/domain/shared/id';
import {
  allocatePostings,
  balanced,
  defaultAllocation,
  incomePostings,
  nonnegativeMinor,
  outboundPostings,
  positiveMinor,
  reversePostings,
  type AccountBucket,
  type MoneyPosting,
} from '@/src/domain/money/ledger';
import { MoneyRuleError } from '@/src/domain/money/ledger';
import type { MoneyRepository, MoneyTx } from './money-repository';

export class MoneyDomainError extends Error {
  constructor(
    readonly code:
      | 'FORBIDDEN'
      | 'RESOURCE_NOT_FOUND'
      | 'DOMAIN_RULE_VIOLATION'
      | 'INSUFFICIENT_FUNDS'
      | 'RESOURCE_STATE_CHANGED'
      | 'STALE_VERSION',
    message: string,
  ) {
    super(message);
    this.name = 'MoneyDomainError';
  }
}
function guardian(
  actor: ActorContext,
): asserts actor is Extract<ActorContext, { kind: 'GUARDIAN' }> {
  if (actor.kind !== 'GUARDIAN')
    throw new MoneyDomainError('FORBIDDEN', 'Guardian must authorize money changes.');
  return actor;
}
export class MoneyService {
  constructor(
    private readonly repository: MoneyRepository,
    private readonly identity: IdentityRepository,
  ) {}

  private async childAndCurrency(actor: ActorContext, childId: string) {
    if (actor.kind === 'SYSTEM' || (actor.kind === 'CHILD' && actor.childId !== childId))
      throw new MoneyDomainError('RESOURCE_NOT_FOUND', 'Wallet not found.');
    const child = await this.identity.getChild(actor.familyId, childId as ChildId);
    const family = await this.identity.getFamily(actor.familyId);
    if (!child || !family) throw new MoneyDomainError('RESOURCE_NOT_FOUND', 'Wallet not found.');
    return { familyId: actor.familyId, childId, currency: family.currency };
  }
  private convert<T>(f: () => T): T {
    try {
      return f();
    } catch (e) {
      if (e instanceof MoneyRuleError) {
        throw new MoneyDomainError(
          e.message.includes('Insufficient') ? 'INSUFFICIENT_FUNDS' : 'DOMAIN_RULE_VIOLATION',
          e.message,
        );
      }
      throw e;
    }
  }
  private async financialLock(actor: ActorContext, childId: string) {
    const who = await this.childAndCurrency(actor, childId);
    await this.repository.lockWallet(who.familyId, who.childId);
    const accounts = await this.repository.ensureAccounts(who.familyId, who.childId, who.currency);
    const balances = await this.repository.balances(who.familyId, who.childId);
    return { ...who, accounts, balances };
  }
  private async commit(input: {
    actor: ActorContext;
    childId: string;
    kind: MoneyTx['kind'];
    postings: readonly MoneyPosting[];
    note: string;
    occurredAt: Date;
    now: Date;
    jobId?: string | null;
    correctionOf?: string | null;
    wallet: Awaited<ReturnType<MoneyService['financialLock']>>;
  }) {
    const { wallet: w } = input;
    this.convert(() => balanced(input.postings));
    for (const bucket of ['UNALLOCATED', 'GIVE', 'SAVE', 'SPEND'] as const) {
      const delta = input.postings
        .filter((p) => p.bucket === bucket)
        .reduce((sum, p) => sum + p.amount, 0n);
      if (w.balances[bucket] + delta < 0n)
        throw new MoneyDomainError(
          'INSUFFICIENT_FUNDS',
          'This transaction exceeds available child funds.',
        );
    }
    const futureSave =
      w.balances.SAVE +
      input.postings.filter((p) => p.bucket === 'SAVE').reduce((sum, p) => sum + p.amount, 0n);
    if (futureSave < (await this.repository.activeSavingAllocations(w.familyId, w.childId)))
      throw new MoneyDomainError(
        'INSUFFICIENT_FUNDS',
        'Saved money is assigned to an active saving goal.',
      );
    const tx: MoneyTx = {
      id: newId<'MoneyTransactionId'>(),
      familyId: w.familyId,
      childId: w.childId,
      kind: input.kind,
      currency: w.currency,
      jobId: input.jobId ?? null,
      correctionOf: input.correctionOf ?? null,
      note: input.note.trim(),
      occurredAt: input.occurredAt,
      recordedAt: input.now,
    };
    await this.repository.post(tx, input.postings, w.accounts);
    return tx;
  }
  async creditJob(
    actor: ActorContext,
    input: { childId: string; jobId: string; amountMinor: string; occurredAt: Date; now: Date },
  ) {
    guardian(actor);
    const w = await this.financialLock(actor, input.childId);
    const amount = this.convert(() => positiveMinor(input.amountMinor));
    return this.commit({
      actor,
      childId: input.childId,
      kind: 'JOB_INCOME',
      postings: incomePostings(amount),
      note: 'Approved paid job',
      jobId: input.jobId,
      occurredAt: input.occurredAt,
      now: input.now,
      wallet: w,
    });
  }
  async recordIncome(
    actor: ActorContext,
    input: {
      childId: string;
      kind: 'GIFT' | 'ALLOWANCE';
      amountMinor: string;
      note: string;
      occurredAt: Date;
      now: Date;
    },
  ) {
    guardian(actor);
    const w = await this.financialLock(actor, input.childId);
    const amount = this.convert(() => positiveMinor(input.amountMinor));
    return this.commit({
      actor,
      childId: input.childId,
      kind: input.kind,
      postings: incomePostings(amount),
      note: input.note,
      occurredAt: input.occurredAt,
      now: input.now,
      wallet: w,
    });
  }
  async allocate(
    actor: ActorContext,
    input: {
      childId: string;
      giveMinor: string;
      saveMinor: string;
      spendMinor: string;
      occurredAt: Date;
      now: Date;
    },
  ) {
    guardian(actor); // no persisted money-autonomy grants yet; do not infer from age.
    const w = await this.financialLock(actor, input.childId);
    const postings = this.convert(() =>
      allocatePostings({
        available: w.balances.UNALLOCATED,
        give: nonnegativeMinor(input.giveMinor),
        save: nonnegativeMinor(input.saveMinor),
        spend: nonnegativeMinor(input.spendMinor),
      }),
    );
    return this.commit({
      actor,
      childId: input.childId,
      kind: 'ALLOCATION',
      postings,
      note: 'Give / Save / Spend allocation',
      occurredAt: input.occurredAt,
      now: input.now,
      wallet: w,
    });
  }
  async outgoing(
    actor: ActorContext,
    input: {
      childId: string;
      kind: 'GIVING' | 'SPEND';
      amountMinor: string;
      note: string;
      occurredAt: Date;
      now: Date;
    },
  ) {
    guardian(actor);
    const w = await this.financialLock(actor, input.childId);
    const bucket = input.kind === 'GIVING' ? 'GIVE' : 'SPEND';
    const postings = this.convert(() =>
      outboundPostings(bucket, positiveMinor(input.amountMinor), w.balances[bucket]),
    );
    return this.commit({
      actor,
      childId: input.childId,
      kind: input.kind,
      postings,
      note: input.note,
      occurredAt: input.occurredAt,
      now: input.now,
      wallet: w,
    });
  }
  async correct(
    actor: ActorContext,
    input: { transactionId: string; reason: string; occurredAt: Date; now: Date },
  ) {
    guardian(actor);
    const original = await this.repository.findTransaction(actor.familyId, input.transactionId);
    if (!original) throw new MoneyDomainError('RESOURCE_NOT_FOUND', 'Transaction not found.');
    const w = await this.financialLock(actor, original.tx.childId);
    if (
      original.tx.kind === 'CORRECTION' ||
      (await this.repository.hasCorrection(w.familyId, original.tx.id))
    )
      throw new MoneyDomainError(
        'RESOURCE_STATE_CHANGED',
        'Transaction has already been reversed.',
      );
    const postings = this.convert(() => reversePostings(original.postings));
    return this.commit({
      actor,
      childId: w.childId,
      kind: 'CORRECTION',
      postings,
      note: input.reason,
      correctionOf: original.tx.id,
      occurredAt: input.occurredAt,
      now: input.now,
      wallet: w,
    });
  }
  async createSavingGoal(
    actor: ActorContext,
    input: { childId: string; title: string; targetMinor: string },
  ) {
    guardian(actor);
    const w = await this.financialLock(actor, input.childId);
    const target = this.convert(() => positiveMinor(input.targetMinor));
    const goal = {
      id: newId<'SavingGoalId'>(),
      familyId: w.familyId,
      childId: w.childId,
      title: input.title.trim(),
      targetMinor: target.toString(),
      status: 'ACTIVE' as const,
      version: 1,
    };
    await this.repository.createSavingGoal(goal);
    return goal;
  }
  async allocateToSavingGoal(
    actor: ActorContext,
    input: { savingGoalId: string; amountMinor: string },
  ) {
    guardian(actor);
    // Read goal to locate child; then obtain wallet lock before row-locking/updating allocation.
    const found = await this.repository.lockSavingGoal(actor.familyId, input.savingGoalId);
    if (!found) throw new MoneyDomainError('RESOURCE_NOT_FOUND', 'Saving goal not found.');
    const w = await this.financialLock(actor, found.childId);
    const goal = await this.repository.lockSavingGoal(actor.familyId, input.savingGoalId);
    if (!goal || goal.status !== 'ACTIVE')
      throw new MoneyDomainError('RESOURCE_STATE_CHANGED', 'Saving goal is not active.');
    const amount = this.convert(() => positiveMinor(input.amountMinor));
    const goals = await this.repository.listSavingGoals(w.familyId, w.childId);
    const allocated = BigInt(goals.find((g) => g.id === goal.id)?.allocatedMinor ?? '0');
    if (allocated + amount > BigInt(goal.targetMinor))
      throw new MoneyDomainError('INSUFFICIENT_FUNDS', 'Saving goal would exceed its target.');
    if (
      (await this.repository.activeSavingAllocations(w.familyId, w.childId)) + amount >
      w.balances.SAVE
    )
      throw new MoneyDomainError('INSUFFICIENT_FUNDS', 'Not enough unassigned SAVE money.');
    await this.repository.addSavingGoalAllocation({
      id: newId<'SavingAllocationId'>(),
      familyId: w.familyId,
      childId: w.childId,
      savingGoalId: goal.id,
      amountMinor: amount,
    });
    return { savingGoalId: goal.id, allocatedMinor: (allocated + amount).toString() };
  }
  async closeSavingGoal(actor: ActorContext, id: string, version: number | undefined) {
    guardian(actor);
    const found = await this.repository.lockSavingGoal(actor.familyId, id);
    if (!found) throw new MoneyDomainError('RESOURCE_NOT_FOUND', 'Saving goal not found.');
    await this.financialLock(actor, found.childId);
    if (version === undefined || version !== found.version)
      throw new MoneyDomainError('STALE_VERSION', 'Saving goal changed on another device.');
    if (found.status !== 'ACTIVE')
      throw new MoneyDomainError('RESOURCE_STATE_CHANGED', 'Saving goal was already closed.');
    if (!(await this.repository.closeSavingGoal(actor.familyId, id, version)))
      throw new MoneyDomainError('STALE_VERSION', 'Saving goal changed on another device.');
    // Closing removes an earmark, NOT money: SAVE ownership never transfers to SPEND.
    return { savingGoalId: id, status: 'CLOSED' as const };
  }
  async view(actor: ActorContext, childId: string) {
    const w = await this.childAndCurrency(actor, childId);
    const [balances, history, goals] = await Promise.all([
      this.repository.balances(w.familyId, childId),
      this.repository.history(w.familyId, childId),
      this.repository.listSavingGoals(w.familyId, childId),
    ]);
    return {
      childId,
      currency: w.currency,
      defaults: defaultAllocation,
      balances: {
        unallocated: balances.UNALLOCATED.toString(),
        give: balances.GIVE.toString(),
        save: balances.SAVE.toString(),
        spend: balances.SPEND.toString(),
      },
      savingGoals: goals,
      transactions: history.slice(-30).map(({ tx, postings }) => ({
        id: tx.id,
        kind: tx.kind,
        note: tx.note,
        occurredAt: tx.occurredAt.toISOString(),
        correctionOf: tx.correctionOf,
        postings: postings
          .filter((p) => p.bucket !== 'EXTERNAL')
          .map((p) => ({ bucket: p.bucket, amountMinor: p.amount.toString() })),
      })),
    };
  }
}
