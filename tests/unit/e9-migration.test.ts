import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
describe('E9 Moment persistence and family isolation', () => {
  const sql = fs.readFileSync('drizzle/0013_moments.sql', 'utf8');
  it('scopes children and authors by family', () => {
    expect(sql).toContain('FOREIGN KEY ("subject_child_id","family_id")');
    expect(sql).toContain('FOREIGN KEY ("author_child_id","family_id")');
    expect(sql).toContain('FOREIGN KEY ("moment_id","family_id")');
  });
  it('keeps published corrections and archive snapshots append-only', () => {
    expect(sql).toContain('"moment_revisions"');
    expect(sql).toContain('"before_snapshot" jsonb');
    expect(sql).toContain('"after_snapshot" jsonb NOT NULL');
    expect(sql).toContain('BEFORE UPDATE OR DELETE');
    expect(sql).toContain('"moment_revisions_unique"');
  });
  it('contains neither money nor moral score columns', () => {
    expect(sql).not.toMatch(/"score"|"points"|"moral_level"|"kindness_percent"|"xp"|"money_minor"/);
    expect(sql).toContain("'GUARDIAN_PRIVATE'");
    expect(sql).toContain("'FAMILY_SHARED'");
  });
});
