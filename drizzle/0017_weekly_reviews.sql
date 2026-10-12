-- E11: one family review per local review week, with individually owned reflections.
-- No morale score, XP reward, money effect or penalty for skipping.
CREATE TABLE "life_os"."weekly_reviews" (
 "id" uuid PRIMARY KEY,
 "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "week_start" date NOT NULL,
 "week_end" date NOT NULL,
 "review_on" date NOT NULL,
 "timezone" text NOT NULL,
 "status" text NOT NULL DEFAULT 'OPEN',
 "next_focus" text,
 "version" integer NOT NULL DEFAULT 1,
 "started_at" timestamptz NOT NULL DEFAULT now(),
 "finished_at" timestamptz,
 CONSTRAINT "weekly_reviews_id_family_pair" UNIQUE ("id","family_id"),
 CONSTRAINT "weekly_reviews_one_per_week" UNIQUE ("family_id","week_start"),
 CONSTRAINT "weekly_reviews_valid_window" CHECK ("week_end"="week_start"+7),
 CONSTRAINT "weekly_reviews_due" CHECK ("review_on"="week_end"),
 CONSTRAINT "weekly_reviews_status_check" CHECK ("status" IN ('OPEN','COMPLETED','SKIPPED','ABANDONED')),
 CONSTRAINT "weekly_reviews_version_check" CHECK ("version">0),
 CONSTRAINT "weekly_reviews_focus_check" CHECK (("status"='COMPLETED' AND length(btrim(coalesce("next_focus",'')))>=3) OR
   ("status"<>'COMPLETED' AND "next_focus" IS NULL)),
 CONSTRAINT "weekly_reviews_finish_check" CHECK (("status"='OPEN' AND "finished_at" IS NULL) OR
   ("status"<>'OPEN' AND "finished_at" IS NOT NULL))
);
CREATE INDEX "weekly_reviews_family_recent" ON "life_os"."weekly_reviews"("family_id","week_start" DESC);
CREATE TABLE "life_os"."weekly_review_entries" (
 "id" uuid PRIMARY KEY,
 "family_id" uuid NOT NULL,
 "review_id" uuid NOT NULL,
 "author_key" text NOT NULL,
 "author_kind" text NOT NULL,
 "author_child_id" uuid,
 "author_guardian_id" uuid,
 "prompt" text NOT NULL,
 "response_text" text NOT NULL,
 "version" integer NOT NULL DEFAULT 1,
 "updated_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "weekly_review_entries_review_fk" FOREIGN KEY ("review_id","family_id")
   REFERENCES "life_os"."weekly_reviews"("id","family_id") ON DELETE CASCADE,
 CONSTRAINT "weekly_review_entries_child_fk" FOREIGN KEY ("author_child_id","family_id")
   REFERENCES "life_os"."child_profiles"("id","family_id"),
 CONSTRAINT "weekly_review_entries_guardian_fk" FOREIGN KEY ("family_id","author_guardian_id")
   REFERENCES "life_os"."family_guardians"("family_id","guardian_id"),
 CONSTRAINT "weekly_review_entries_owner_check" CHECK (("author_kind"='CHILD' AND
   "author_child_id" IS NOT NULL AND "author_guardian_id" IS NULL AND
   "author_key"='CHILD:'||"author_child_id"::text) OR
  ("author_kind"='GUARDIAN' AND "author_guardian_id" IS NOT NULL AND
   "author_child_id" IS NULL AND "author_key"='GUARDIAN:'||"author_guardian_id"::text)),
 CONSTRAINT "weekly_review_entries_prompt_check" CHECK ("prompt" IN
   ('PROUD','DIFFICULT','LEARNED','HELPED','IMPROVE','NEXT_FOCUS')),
 CONSTRAINT "weekly_review_entries_text_check" CHECK (length(btrim("response_text")) BETWEEN 1 AND 1200),
 CONSTRAINT "weekly_review_entries_version_check" CHECK ("version">0),
 CONSTRAINT "weekly_review_entries_unique" UNIQUE ("review_id","author_key","prompt")
);
CREATE INDEX "weekly_review_entries_review" ON "life_os"."weekly_review_entries"("family_id","review_id");
-- Prevent updates to reflection entries after the weekly review is finished, even outside HTTP APIs.
CREATE OR REPLACE FUNCTION "life_os"."weekly_review_require_open"() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "life_os"."weekly_reviews"
  WHERE "id"=NEW.review_id AND "family_id"=NEW.family_id AND "status"='OPEN') THEN
  RAISE EXCEPTION 'Weekly review is closed';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "weekly_review_entry_open" BEFORE INSERT OR UPDATE ON "life_os"."weekly_review_entries"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."weekly_review_require_open"();
