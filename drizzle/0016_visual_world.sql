-- Semantic milestones only. No artwork paths, positions, scores, child rankings or animation persistence.
CREATE TABLE "life_os"."world_unlocks" (
 "id" uuid PRIMARY KEY,
 "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "child_id" uuid,
 "world_scope" text NOT NULL,
 "semantic_dimension" text NOT NULL,
 "milestone_key" text NOT NULL,
 "source_event_id" uuid NOT NULL REFERENCES "life_os"."domain_events"("id"),
 "unlocked_at" timestamptz NOT NULL,
 CONSTRAINT "world_unlocks_family_child_fk" FOREIGN KEY ("child_id","family_id")
  REFERENCES "life_os"."child_profiles"("id","family_id"),
 CONSTRAINT "world_scope_check" CHECK (("world_scope"='PERSONAL' AND "child_id" IS NOT NULL)
  OR ("world_scope"='FAMILY' AND "child_id" IS NULL)),
 CONSTRAINT "world_dimension_check" CHECK ("semantic_dimension" IN
  ('INDEPENDENCE','AUTONOMY','LEARNING','GOALS','KINDNESS','FAMILY')),
 CONSTRAINT "world_milestone_check" CHECK ("milestone_key" IN
  ('HOME_PATH','BRIDGE_READY','LIBRARY_OPEN','OBSERVATORY_LIT','GIVING_GARDEN','FAMILY_TREE','FAMILY_GARDEN')),
 CONSTRAINT "world_source_milestone_unique" UNIQUE ("family_id","source_event_id","milestone_key")
);
CREATE INDEX "world_child_scope_idx" ON "life_os"."world_unlocks"("family_id","world_scope","child_id","unlocked_at");
CREATE OR REPLACE FUNCTION "life_os"."reject_world_history_mutation"() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Semantic unlocks are append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "world_unlocks_immutable" BEFORE UPDATE OR DELETE ON "life_os"."world_unlocks"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_world_history_mutation"();
