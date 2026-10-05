CREATE TABLE IF NOT EXISTS "life_os"."families" (
  "id" uuid PRIMARY KEY,
  "name" text NOT NULL,
  "timezone" text NOT NULL,
  "currency" char(3) NOT NULL,
  "weekly_review_day" smallint,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  CONSTRAINT "families_weekly_review_day_check"
    CHECK ("weekly_review_day" IS NULL OR ("weekly_review_day" BETWEEN 0 AND 6))
);

CREATE TABLE IF NOT EXISTS "life_os"."guardian_profiles" (
  "id" uuid PRIMARY KEY,
  "supabase_user_id" uuid NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "life_os"."family_guardians" (
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "guardian_id" uuid NOT NULL REFERENCES "life_os"."guardian_profiles"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("family_id", "guardian_id"),
  CONSTRAINT "family_guardian_role_check" CHECK ("role" IN ('OWNER', 'GUARDIAN'))
);
CREATE INDEX IF NOT EXISTS "family_guardians_guardian_idx"
  ON "life_os"."family_guardians" ("guardian_id");

CREATE TABLE IF NOT EXISTS "life_os"."child_profiles" (
  "id" uuid PRIMARY KEY,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "display_name" text NOT NULL,
  "birth_date" date NOT NULL,
  "avatar_key" text,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  CONSTRAINT "child_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
  UNIQUE ("id", "family_id")
);
CREATE INDEX IF NOT EXISTS "child_family_idx"
  ON "life_os"."child_profiles" ("family_id");

CREATE TABLE IF NOT EXISTS "life_os"."experience_preferences" (
  "child_id" uuid PRIMARY KEY REFERENCES "life_os"."child_profiles"("id") ON DELETE CASCADE,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "visualization" text NOT NULL,
  "motion" text NOT NULL,
  "theme_key" text NOT NULL DEFAULT 'island',
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  CONSTRAINT "experience_visualization_check"
    CHECK ("visualization" IN ('IMMERSIVE', 'BALANCED', 'FOCUSED')),
  CONSTRAINT "experience_motion_check"
    CHECK ("motion" IN ('FULL', 'REDUCED', 'OFF')),
  CONSTRAINT "experience_child_family_fk"
    FOREIGN KEY ("child_id", "family_id")
    REFERENCES "life_os"."child_profiles"("id", "family_id")
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "experience_preferences_family_idx"
  ON "life_os"."experience_preferences" ("family_id");
