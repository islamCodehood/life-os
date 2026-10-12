import fs from 'node:fs';
import {describe,expect,it} from 'vitest';
describe('E12 durable outbox + privacy contracts',()=>{
 const sql=fs.readFileSync('drizzle/0018_notifications_outbox.sql','utf8');
 it('deduplicates intents and outbox messages',()=>{
  expect(sql).toContain('CONSTRAINT "notification_intent_unique"');
  expect(sql).toContain('CONSTRAINT "outbox_intent_unique"');
  expect(sql).toContain('CONSTRAINT "scheduler_run_bucket_unique"');
  expect(sql).toContain('"attempt_count" integer NOT NULL DEFAULT 0');
 });
 it('requires opt-in settings and actor-bound device subscriptions',()=>{
  expect(sql).toContain('"enabled" boolean NOT NULL DEFAULT false');
  expect(sql).toContain('FOREIGN KEY ("family_id","actor_key")');
  expect(sql).toContain('ON DELETE CASCADE');
  expect(sql).toContain('"push_subscriptions_endpoint_unique"');
 });
 it('cannot credit ignored child reminders from delivery attempts',()=>{
  expect(sql).not.toContain('UPDATE "life_os"."reminder_records"');
  expect(sql).not.toMatch(/"punishment"|"moral_score"|"xp_amount"/);
 });
});
