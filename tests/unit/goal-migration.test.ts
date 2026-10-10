import fs from 'node:fs';
import {describe,it,expect} from 'vitest';
describe('E7 goals persistence invariants',()=>{
 const sql=fs.readFileSync('drizzle/0010_goals.sql','utf8');
 it('stores family-owned SharedGoal and child-private goals separately',()=>{
  expect(sql).toContain('"owner_type" = \'FAMILY\' AND "owner_child_id" IS NULL');
  expect(sql).toContain('"category" = \'SHARED\'');
  expect(sql).toContain('"owner_child_id","family_id"');
 });
 it('prohibits FAILED and stores audit history append-only',()=>{
  expect(sql).not.toContain("'FAILED'");
  expect(sql).toContain('"goal_progress_entries"');
  expect(sql).toContain('"goal_revisions"');
  expect(sql).toContain('"goal_reflections"');
  expect(sql).toContain('BEFORE UPDATE OR DELETE');
 });
 it('constrains progress and keeps family boundaries',()=>{
  expect(sql).toContain('"progress" <= "target"');
  expect(sql).toContain('FOREIGN KEY ("goal_id","family_id")');
 });
});
