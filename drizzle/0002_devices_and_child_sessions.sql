CREATE TABLE IF NOT EXISTS "life_os"."household_devices" (
  "id" uuid PRIMARY KEY,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "token_hash" char(64) NOT NULL UNIQUE,
  "trusted_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz,
  "revoked_at" timestamptz,
  "version" integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS "household_devices_family_idx"
  ON "life_os"."household_devices" ("family_id");

CREATE TABLE IF NOT EXISTS "life_os"."child_pin_credentials" (
  "child_id" uuid PRIMARY KEY REFERENCES "life_os"."child_profiles"("id") ON DELETE CASCADE,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "pin_hash" text NOT NULL,
  "failed_attempts" integer NOT NULL DEFAULT 0,
  "locked_until" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS "child_pin_credentials_family_idx"
  ON "life_os"."child_pin_credentials" ("family_id");

CREATE TABLE IF NOT EXISTS "life_os"."child_sessions" (
  "id" uuid PRIMARY KEY,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "child_id" uuid NOT NULL REFERENCES "life_os"."child_profiles"("id") ON DELETE CASCADE,
  "device_id" uuid NOT NULL REFERENCES "life_os"."household_devices"("id") ON DELETE CASCADE,
  "token_hash" char(64) NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "child_sessions_child_idx"
  ON "life_os"."child_sessions" ("family_id", "child_id");
CREATE INDEX IF NOT EXISTS "child_sessions_device_idx"
  ON "life_os"."child_sessions" ("device_id");

CREATE TABLE IF NOT EXISTS "life_os"."processed_commands" (
  "command_id" uuid PRIMARY KEY,
  "request_hash" text NOT NULL,
  "actor_kind" text NOT NULL,
  "actor_id" uuid,
  "family_id" uuid,
  "status" text NOT NULL,
  "response_json" jsonb,
  "processed_at" timestamptz NOT NULL DEFAULT now()
);
