import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('E8 financial persistence defense-in-depth', () => {
  const migration = fs.readFileSync('drizzle/0011_jobs_money.sql', 'utf8');
  it('uses exact integer money and child-family composite foreign keys', () => {
    expect(migration).toContain('"payment_minor" bigint NOT NULL');
    expect(migration).toContain('"amount_minor" bigint NOT NULL');
    expect(migration).toContain('FOREIGN KEY ("account_id","family_id","child_id")');
    expect(migration).toContain('FOREIGN KEY ("child_id","family_id")');
  });
  it('rejects unbalanced or empty financial transactions at commit', () => {
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain('posting_count<2 OR total<>0');
    expect(migration).toContain('CREATE CONSTRAINT TRIGGER "money_transaction_balanced"');
  });
  it('prevents mutation and double-credit of one paid job', () => {
    expect(migration).toContain('BEFORE UPDATE OR DELETE');
    expect(migration).toContain('"money_transactions_immutable"');
    expect(migration).toContain('"money_postings_immutable"');
    expect(migration).toContain('"money_tx_one_credit_per_job"');
    expect(migration).toContain('"money_tx_one_correction"');
  });
  it('retains SAVE when a saving goal closes', () => {
    expect(migration).toContain('"saving_goals"');
    expect(migration).toContain('"saving_goal_allocations"');
    expect(migration).toContain('"saving_allocations_immutable"');
  });
});
