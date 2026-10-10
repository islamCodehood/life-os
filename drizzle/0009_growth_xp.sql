-- E6: skill-specific XP. Rows are append-only; corrections are compensating entries.
INSERT INTO "life_os"."activity_templates" (
  "key","title","description","why","category","default_schedule_rrule",
  "default_local_target_time","default_available_offset_minutes",
  "default_opportunity_end_offset_minutes","default_tracking_mode",
  "default_completion_mode","default_approval_mode","default_progress_mode","default_xp_mode"
) VALUES
 ('GROWTH_READING','Reading practice','Read for a focused practice session.',
  'Build reading skill through practice.','GROWTH','FREQ=DAILY','17:00',-120,180,
  'CHECK','SELF_CONFIRM','NONE','MASTERY','ALLOWED'),
 ('GROWTH_CHESS_PRACTICE','Chess practice','Practice chess for a focused session.',
  'Build strategy and patience through practice.','GROWTH','FREQ=DAILY','18:00',-120,180,
  'CHECK','SELF_CONFIRM','NONE','MASTERY','ALLOWED')
ON CONFLICT ("key") DO NOTHING;

CREATE TABLE "life_os"."xp_ledger" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "child_id" uuid NOT NULL,
  "skill_key" text NOT NULL,
  "entry_type" text NOT NULL,
  "amount" integer NOT NULL,
  "source_event_id" uuid NOT NULL REFERENCES "life_os"."domain_events"("id"),
  "correction_of" uuid,
  "correction_reason" text,
  "occurred_at" timestamptz NOT NULL,
  "recorded_at" timestamptz NOT NULL,
  CONSTRAINT "xp_ledger_child_family_fk" FOREIGN KEY ("child_id","family_id")
    REFERENCES "life_os"."child_profiles"("id","family_id") ON DELETE CASCADE,
  CONSTRAINT "xp_ledger_id_family_unique" UNIQUE ("id","family_id"),
  CONSTRAINT "xp_ledger_correction_family_fk" FOREIGN KEY ("correction_of","family_id")
    REFERENCES "life_os"."xp_ledger"("id","family_id"),
  CONSTRAINT "xp_ledger_amount_check" CHECK (
    ("entry_type" = 'GRANT' AND "amount" > 0 AND "correction_of" IS NULL AND "correction_reason" IS NULL) OR
    ("entry_type" = 'CORRECTION' AND "amount" < 0 AND "correction_of" IS NOT NULL AND "correction_reason" IS NOT NULL AND length(trim("correction_reason")) > 0)
  ),
  CONSTRAINT "xp_ledger_skill_check" CHECK ("skill_key" IN ('READING', 'CHESS'))
);
CREATE UNIQUE INDEX "xp_ledger_source_event_unique" ON "life_os"."xp_ledger"("source_event_id");
CREATE UNIQUE INDEX "xp_ledger_one_correction_unique" ON "life_os"."xp_ledger"("correction_of")
 WHERE "correction_of" IS NOT NULL;
CREATE INDEX "xp_ledger_child_skill_idx" ON "life_os"."xp_ledger"("family_id","child_id","skill_key");
-- Ordinary app role must never UPDATE/DELETE ledger rows.
CREATE OR REPLACE FUNCTION "life_os"."reject_xp_ledger_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'XP ledger is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "xp_ledger_no_update_delete"
  BEFORE UPDATE OR DELETE ON "life_os"."xp_ledger"
  FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_xp_ledger_mutation"();
