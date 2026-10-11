-- E9: curated child Moments. No scores, XP, points, money or moral levels.
CREATE TABLE "life_os"."moments" (
 "id" uuid PRIMARY KEY,
 "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "subject_child_id" uuid,
 "author_kind" text NOT NULL,
 "author_child_id" uuid,
 "title" text NOT NULL,
 "description" text NOT NULL,
 "privacy" text NOT NULL,
 "occurred_at" timestamptz NOT NULL,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now(),
 "status" text NOT NULL DEFAULT 'PUBLISHED',
 "version" integer NOT NULL DEFAULT 1,
 CONSTRAINT "moments_id_family_uidx" UNIQUE ("id","family_id"),
 CONSTRAINT "moments_child_family_fk" FOREIGN KEY ("subject_child_id","family_id")
   REFERENCES "life_os"."child_profiles"("id","family_id"),
 CONSTRAINT "moments_author_family_fk" FOREIGN KEY ("author_child_id","family_id")
   REFERENCES "life_os"."child_profiles"("id","family_id"),
 CONSTRAINT "moments_privacy_check" CHECK ("privacy" IN ('CHILD_SAFE','FAMILY_SHARED','GUARDIAN_PRIVATE')),
 CONSTRAINT "moments_owner_check" CHECK (("privacy"='FAMILY_SHARED' AND "subject_child_id" IS NULL)
   OR ("privacy"<>'FAMILY_SHARED' AND "subject_child_id" IS NOT NULL)),
 CONSTRAINT "moments_status_check" CHECK ("status" IN ('PUBLISHED','ARCHIVED')),
 CONSTRAINT "moments_author_check" CHECK (("author_kind"='GUARDIAN' AND "author_child_id" IS NULL)
   OR ("author_kind"='CHILD' AND "author_child_id" IS NOT NULL)),
 CONSTRAINT "moments_version_check" CHECK ("version">0)
);
CREATE INDEX "moments_private_idx" ON "life_os"."moments"("family_id","subject_child_id","occurred_at");
CREATE INDEX "moments_family_shared_idx" ON "life_os"."moments"("family_id","privacy","occurred_at");

-- Current tags for each version are append-only; old versions stay auditable.
CREATE TABLE "life_os"."moment_tags" (
 "id" uuid PRIMARY KEY,
 "family_id" uuid NOT NULL,
 "moment_id" uuid NOT NULL,
 "moment_version" integer NOT NULL,
 "tag" text NOT NULL,
 CONSTRAINT "moment_tags_moment_fk" FOREIGN KEY ("moment_id","family_id")
   REFERENCES "life_os"."moments"("id","family_id"),
 CONSTRAINT "moment_tags_value_check" CHECK ("tag" IN ('KINDNESS','HONESTY','GENEROSITY','COURAGE','PATIENCE','PERSEVERANCE','FAMILY','INITIATIVE')),
 CONSTRAINT "moment_tags_version_check" CHECK ("moment_version">0),
 CONSTRAINT "moment_tags_unique" UNIQUE ("moment_id","moment_version","tag")
);
CREATE INDEX "moment_tags_version_idx" ON "life_os"."moment_tags"("family_id","moment_id","moment_version");

-- All published revisions remain parent-auditable, even after archive.
CREATE TABLE "life_os"."moment_revisions" (
 "id" uuid PRIMARY KEY,
 "family_id" uuid NOT NULL,
 "moment_id" uuid NOT NULL,
 "version" integer NOT NULL,
 "action" text NOT NULL,
 "before_snapshot" jsonb,
 "after_snapshot" jsonb NOT NULL,
 "edited_by_kind" text NOT NULL,
 "edited_at" timestamptz NOT NULL DEFAULT now(),
 "reason" text,
 CONSTRAINT "moment_revisions_moment_fk" FOREIGN KEY ("moment_id","family_id")
   REFERENCES "life_os"."moments"("id","family_id"),
 CONSTRAINT "moment_revisions_action_check" CHECK ("action" IN ('RECORDED','UPDATED','ARCHIVED')),
 CONSTRAINT "moment_revisions_unique" UNIQUE ("moment_id","version")
);
CREATE OR REPLACE FUNCTION "life_os"."reject_moment_history_mutation"() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Published Moment history is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "moment_tags_immutable" BEFORE UPDATE OR DELETE ON "life_os"."moment_tags"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_moment_history_mutation"();
CREATE TRIGGER "moment_revisions_immutable" BEFORE UPDATE OR DELETE ON "life_os"."moment_revisions"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_moment_history_mutation"();
