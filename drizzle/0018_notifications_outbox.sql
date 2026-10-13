-- E12: opt-in channels, durable push intents and worker coordination.
CREATE TABLE "life_os"."notification_preferences" (
 "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "actor_key" text NOT NULL,
 "enabled" boolean NOT NULL DEFAULT false,
 "quiet_start" text NOT NULL DEFAULT '21:00',
 "quiet_end" text NOT NULL DEFAULT '07:00',
 "updated_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "notification_preferences_pk" PRIMARY KEY ("family_id","actor_key"),
 CONSTRAINT "notification_preferences_clock_check" CHECK (
  "quiet_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
  "quiet_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE TABLE "life_os"."push_subscriptions" (
 "id" uuid PRIMARY KEY,
 "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "actor_key" text NOT NULL,
 "endpoint" text NOT NULL,
 "p256dh" text NOT NULL,
 "auth_secret" text NOT NULL,
 "locale" text NOT NULL DEFAULT 'en',
 "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE ("endpoint"),
 CONSTRAINT "push_subscriptions_locale" CHECK ("locale" IN ('en','ar')),
 CONSTRAINT "push_subscriptions_actor_pref_fk" FOREIGN KEY ("family_id","actor_key")
   REFERENCES "life_os"."notification_preferences"("family_id","actor_key") ON DELETE CASCADE
);
CREATE INDEX "push_subscriptions_actor_idx" ON "life_os"."push_subscriptions"("family_id","actor_key");
CREATE TABLE "life_os"."notification_intents" (
 "id" uuid PRIMARY KEY,
 "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "actor_key" text NOT NULL,
 "kind" text NOT NULL,
 "source_key" text NOT NULL,
 "target_path" text NOT NULL,
 "due_at" timestamptz NOT NULL,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "notification_intent_kind_check" CHECK ("kind" IN
  ('ACTIVITY_REMINDER','GRADUATED_MONITORING','SUGGESTION_REVIEW')),
 CONSTRAINT "notification_intent_unique" UNIQUE ("family_id","actor_key","source_key")
);
CREATE TABLE "life_os"."outbox_messages" (
 "id" uuid PRIMARY KEY,
 "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "intent_id" uuid NOT NULL REFERENCES "life_os"."notification_intents"("id") ON DELETE CASCADE,
 "message_type" text NOT NULL DEFAULT 'SEND_PUSH',
 "status" text NOT NULL DEFAULT 'PENDING',
 "attempt_count" integer NOT NULL DEFAULT 0,
 "available_at" timestamptz NOT NULL,
 "locked_at" timestamptz,
 "last_error" text,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 "processed_at" timestamptz,
 CONSTRAINT "outbox_intent_unique" UNIQUE ("intent_id"),
 CONSTRAINT "outbox_type_check" CHECK ("message_type"='SEND_PUSH'),
 CONSTRAINT "outbox_status_check" CHECK ("status" IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
 CONSTRAINT "outbox_attempt_check" CHECK ("attempt_count">=0)
);
CREATE INDEX "outbox_claim_idx" ON "life_os"."outbox_messages"("available_at","created_at")
 WHERE "status" IN ('PENDING','FAILED','PROCESSING');
CREATE TABLE "life_os"."scheduler_runs" (
 "id" uuid PRIMARY KEY,
 "job_key" text NOT NULL,
 "bucket" timestamptz NOT NULL,
 "status" text NOT NULL,
 "started_at" timestamptz NOT NULL DEFAULT now(),
 "finished_at" timestamptz,
 "error_code" text,
 CONSTRAINT "scheduler_run_bucket_unique" UNIQUE ("job_key","bucket")
);
-- Provider acceptance does NOT mark reminder_records.delivered_at.
