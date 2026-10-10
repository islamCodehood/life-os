import type { AccountBucket, MoneyPosting } from '@/src/domain/money/ledger';
export interface MoneyTx {
  id: string;
  familyId: string;
  childId: string;
  kind: 'JOB_INCOME' | 'GIFT' | 'ALLOWANCE' | 'ALLOCATION' | 'SPEND' | 'GIVING' | 'CORRECTION';
  currency: string;
  jobId: string | null;
  correctionOf: string | null;
  note: string;
  occurredAt: Date;
  recordedAt: Date;
}
export interface SavingGoal {
  id: string;
  familyId: string;
  childId: string;
  title: string;
  targetMinor: string;
  status: 'ACTIVE' | 'CLOSED';
  version: number;
}
export interface MoneyRepository {
  lockWallet(familyId: string, childId: string): Promise<void>;
  payableJob(
    familyId: string,
    jobId: string,
  ): Promise<{
    childId: string;
    paymentMinor: string;
    status: string;
    termsVersion: number;
    acceptedTermsVersion: number | null;
  } | null>;
  ensureAccounts(
    familyId: string,
    childId: string,
    currency: string,
  ): Promise<Record<AccountBucket, string>>;
  balances(familyId: string, childId: string): Promise<Record<AccountBucket, bigint>>;
  post(
    tx: MoneyTx,
    postings: readonly MoneyPosting[],
    accounts: Record<AccountBucket, string>,
  ): Promise<void>;
  history(
    familyId: string,
    childId: string,
  ): Promise<Array<{ tx: MoneyTx; postings: MoneyPosting[] }>>;
  findTransaction(
    familyId: string,
    id: string,
  ): Promise<{ tx: MoneyTx; postings: MoneyPosting[] } | null>;
  hasCorrection(familyId: string, id: string): Promise<boolean>;
  createSavingGoal(goal: SavingGoal): Promise<void>;
  lockSavingGoal(familyId: string, id: string): Promise<SavingGoal | null>;
  listSavingGoals(
    familyId: string,
    childId: string,
  ): Promise<Array<SavingGoal & { allocatedMinor: string }>>;
  closeSavingGoal(familyId: string, id: string, version: number): Promise<boolean>;
  addSavingGoalAllocation(input: {
    id: string;
    familyId: string;
    childId: string;
    savingGoalId: string;
    amountMinor: bigint;
  }): Promise<void>;
  activeSavingAllocations(familyId: string, childId: string): Promise<bigint>;
}
