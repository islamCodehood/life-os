import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('E11 weekly-review Postgres guardrails', () => {
  const sql = fs.readFileSync('drizzle/0017_weekly_reviews.sql', 'utf8');
  it('persists at most one review per family/week, with a stable seven-day local window', () => {
    expect(sql).toContain('"weekly_reviews_one_per_week" UNIQUE ("family_id","week_start")');
    expect(sql).toContain('"weekly_reviews_valid_window"');
    expect(sql).toContain('"review_on"="week_end"');
    expect(sql).toContain("'ABANDONED'");
  });
  it('prevents forged child/guardian authorship and sibling ownership', () => {
    expect(sql).toContain('"author_key"');
    expect(sql).toContain('"weekly_review_entries_owner_check"');
    expect(sql).toContain('FOREIGN KEY ("author_child_id","family_id")');
    expect(sql).toContain('FOREIGN KEY ("family_id","author_guardian_id")');
    expect(sql).toContain('"weekly_review_entries_unique"');
  });
  it('blocks writes after completion or skipping and omits any moral scoring', () => {
    expect(sql).toContain('BEFORE INSERT OR UPDATE');
    expect(sql).toContain('Weekly review is closed');
    expect(sql).not.toMatch(/"(?:xp|money|score|points|moral_level|rank|punishment)"/);
  });
});
