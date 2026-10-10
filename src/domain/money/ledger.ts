export type MoneyBucket = 'UNALLOCATED' | 'GIVE' | 'SAVE' | 'SPEND';
export type AccountBucket = MoneyBucket | 'EXTERNAL';
export interface MoneyPosting {
  bucket: AccountBucket;
  amount: bigint;
}
export interface WalletBalance {
  unallocated: string;
  give: string;
  save: string;
  spend: string;
  currency: string;
}
export const defaultAllocation = { give: 20, save: 60, spend: 20 } as const;
export class MoneyRuleError extends Error {}
export function positiveMinor(value: string): bigint {
  if (!/^[1-9]\d{0,11}$/.test(value))
    throw new MoneyRuleError('Amount must be a positive whole number of minor units.');
  return BigInt(value);
}
export function nonnegativeMinor(value: string): bigint {
  if (!/^(0|[1-9]\d{0,11})$/.test(value))
    throw new MoneyRuleError('Amount must be nonnegative minor units.');
  return BigInt(value);
}
export function balanced(postings: readonly MoneyPosting[]) {
  if (
    postings.length < 2 ||
    postings.some((p) => p.amount === 0n) ||
    postings.reduce((sum, p) => sum + p.amount, 0n) !== 0n
  )
    throw new MoneyRuleError('Money postings must balance exactly to zero.');
  return [...postings];
}
export function incomePostings(amount: bigint): MoneyPosting[] {
  return balanced([
    { bucket: 'UNALLOCATED', amount },
    { bucket: 'EXTERNAL', amount: -amount },
  ]);
}
export function allocatePostings(input: {
  available: bigint;
  give: bigint;
  save: bigint;
  spend: bigint;
}): MoneyPosting[] {
  const { available, give, save, spend } = input;
  const total = give + save + spend;
  if (total <= 0n || [give, save, spend].some((v) => v < 0n) || total !== available)
    throw new MoneyRuleError('Give, Save and Spend must equal all currently unallocated money.');
  const allocations:MoneyPosting[]=[
      {bucket:'GIVE',amount:give},{bucket:'SAVE',amount:save},{bucket:'SPEND',amount:spend},
  ];
  return balanced([{bucket:'UNALLOCATED',amount:-total},...allocations.filter(p=>p.amount!==0n)]);
}
export function outboundPostings(
  bucket: 'GIVE' | 'SPEND',
  amount: bigint,
  available: bigint,
): MoneyPosting[] {
  if (amount <= 0n || amount > available)
    throw new MoneyRuleError('Insufficient funds for this bucket.');
  return balanced([
    { bucket, amount: -amount },
    { bucket: 'EXTERNAL', amount },
  ]);
}
export function reversePostings(original: readonly MoneyPosting[]): MoneyPosting[] {
  return balanced(original.map((p) => ({ bucket: p.bucket, amount: -p.amount })));
}
export function walletTotals(postings: readonly MoneyPosting[], currency: string): WalletBalance {
  const sum = (bucket: MoneyBucket) =>
    postings
      .filter((p) => p.bucket === bucket)
      .reduce((acc, p) => acc + p.amount, 0n)
      .toString();
  return {
    unallocated: sum('UNALLOCATED'),
    give: sum('GIVE'),
    save: sum('SAVE'),
    spend: sum('SPEND'),
    currency,
  };
}
