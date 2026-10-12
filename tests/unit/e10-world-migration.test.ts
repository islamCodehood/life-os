import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('E10 semantic persistence', () => {
  const sql = fs.readFileSync('drizzle/0016_visual_world.sql', 'utf8');
  it('stores theme-independent unlocks with source uniqueness and family scope', () => {
    expect(sql).toContain('"source_event_id" uuid NOT NULL REFERENCES');
    expect(sql).toContain('"world_scope" text NOT NULL');
    expect(sql).toContain('FOREIGN KEY ("child_id","family_id")');
    expect(sql).toContain('"world_source_milestone_unique"');
    expect(sql).toContain('CHECK (("world_scope"');
  });
  it('protects projection history from update/delete', () => {
    expect(sql).toContain('BEFORE UPDATE OR DELETE');
    expect(sql).toContain('"world_unlocks_immutable"');
  });
  it('does not persist visual assets, rankings or client motion preferences', () => {
    expect(sql).not.toMatch(/"(?:theme_key|animation|coordinates|sprite|svg|rank|score|morality)"/);
  });
});
