import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('E6 growth XP migration', () => {
  const migration = fs.readFileSync('drizzle/0009_growth_xp.sql', 'utf8');
  it('seeds distinct growth templates with XP allowed', () => {
    expect(migration).toContain("'GROWTH_READING'");
    expect(migration).toContain("'GROWTH_CHESS_PRACTICE'");
    expect(migration).toContain("'GROWTH'");
    expect(migration).toContain("'MASTERY','ALLOWED'");
  });
  it('persists an append-only ledger tied to canonical events', () => {
    expect(migration).toContain('"xp_ledger"');
    expect(migration).toContain(
      '"source_event_id" uuid NOT NULL REFERENCES "life_os"."domain_events"("id")',
    );
    expect(migration).toContain('"xp_ledger_source_event_unique"');
    expect(migration).toContain('"xp_ledger_one_correction_unique"');
    expect(migration).toContain('"xp_ledger_no_update_delete"');
  });
  it('rejects XP punishment and unfounded negative entries', () => {
    expect(migration).toContain('"entry_type" = \'GRANT\' AND "amount" > 0');
    expect(migration).toContain('"entry_type" = \'CORRECTION\' AND "amount" < 0');
    expect(migration).toContain('"correction_reason" IS NOT NULL');
    expect(migration).toContain('FOREIGN KEY ("correction_of","family_id")');
    expect(migration).not.toContain("'PUNISHMENT'");
  });
});
