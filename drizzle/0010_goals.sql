-- E7 goal ownership, lifecycle and append-only progress/revisions/reflections.
CREATE TABLE "life_os"."goals" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "owner_type" text NOT NULL,
  "owner_child_id" uuid,
  "proposed_by_child_id" uuid,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "why" text NOT NULL,
  "next_step" text NOT NULL,
  "target" integer NOT NULL,
  "progress" integer NOT NULL DEFAULT 0,
  "target_date" date,
  "status" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "goals_family_pair_unique" UNIQUE ("id","family_id"),
  CONSTRAINT "goals_child_family_fk" FOREIGN KEY ("owner_child_id","family_id")
    REFERENCES "life_os"."child_profiles"("id","family_id"),
  CONSTRAINT "goals_proposer_family_fk" FOREIGN KEY ("proposed_by_child_id","family_id")
    REFERENCES "life_os"."child_profiles"("id","family_id"),
  CONSTRAINT "goals_owner_check" CHECK (("owner_type" = 'FAMILY' AND "owner_child_id" IS NULL AND "category" = 'SHARED' AND "proposed_by_child_id" IS NULL) OR
    ("owner_type" = 'CHILD' AND "owner_child_id" IS NOT NULL AND "category" IN ('PERSONAL','GROWTH','PROJECT'))),
  CONSTRAINT "goals_status_check" CHECK ("status" IN ('DRAFT','AWAITING_APPROVAL','ACTIVE','PAUSED','ACHIEVED','CLOSED')),
  CONSTRAINT "goals_target_check" CHECK ("target" > 0 AND "target" <= 1000000 AND "progress" >= 0 AND "progress" <= "target")
);
CREATE INDEX "goals_family_owner_idx" ON "life_os"."goals"("family_id","owner_type","owner_child_id");

CREATE TABLE "life_os"."goal_progress_entries" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "goal_id" uuid NOT NULL,
  "contributed_by_child_id" uuid,
  "amount" integer NOT NULL,
  "step" text NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "recorded_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "goal_progress_positive" CHECK ("amount" > 0 AND "amount" <= 1000000),
  CONSTRAINT "goal_progress_goal_fk" FOREIGN KEY ("goal_id","family_id") REFERENCES "life_os"."goals"("id","family_id") ON DELETE CASCADE,
  CONSTRAINT "goal_progress_child_fk" FOREIGN KEY ("contributed_by_child_id","family_id")
    REFERENCES "life_os"."child_profiles"("id","family_id")
);
CREATE INDEX "goal_progress_goal_idx" ON "life_os"."goal_progress_entries"("family_id","goal_id","recorded_at");

CREATE TABLE "life_os"."goal_revisions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "goal_id" uuid NOT NULL,
  "previous_target" integer NOT NULL,
  "new_target" integer NOT NULL,
  "previous_target_date" date,
  "new_target_date" date,
  "reason" text NOT NULL,
  "revised_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "goal_revisions_goal_fk" FOREIGN KEY ("goal_id","family_id") REFERENCES "life_os"."goals"("id","family_id") ON DELETE CASCADE
);
CREATE INDEX "goal_revisions_goal_idx" ON "life_os"."goal_revisions"("family_id","goal_id","revised_at");

CREATE TABLE "life_os"."goal_reflections" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "goal_id" uuid NOT NULL,
  "author_child_id" uuid,
  "text" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "goal_reflections_goal_fk" FOREIGN KEY ("goal_id","family_id") REFERENCES "life_os"."goals"("id","family_id") ON DELETE CASCADE,
  CONSTRAINT "goal_reflections_child_fk" FOREIGN KEY ("author_child_id","family_id")
    REFERENCES "life_os"."child_profiles"("id","family_id")
);
CREATE INDEX "goal_reflections_goal_idx" ON "life_os"."goal_reflections"("family_id","goal_id","created_at");

-- Historical facts cannot be edited away; projection is derived from append-only progress.
CREATE OR REPLACE FUNCTION "life_os"."reject_goal_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Goal history is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "goal_progress_immutable" BEFORE UPDATE OR DELETE ON "life_os"."goal_progress_entries"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_goal_history_mutation"();
CREATE TRIGGER "goal_revisions_immutable" BEFORE UPDATE OR DELETE ON "life_os"."goal_revisions"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_goal_history_mutation"();
CREATE TRIGGER "goal_reflections_immutable" BEFORE UPDATE OR DELETE ON "life_os"."goal_reflections"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_goal_history_mutation"();
