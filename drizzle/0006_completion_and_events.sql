CREATE TABLE "life_os"."completion_records" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "activity_instance_id" uuid NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reported_by_kind" text NOT NULL,
  "reported_by_id" uuid,
  "self_initiated" boolean NOT NULL,
  "reminder_count_at_completion" integer DEFAULT 0 NOT NULL,
  "source" text NOT NULL,
  CONSTRAINT "completion_records_instance_uidx" UNIQUE("activity_instance_id"),
  CONSTRAINT "completion_records_family_id_families_id_fk"
    FOREIGN KEY ("family_id") REFERENCES "life_os"."families"("id") ON DELETE cascade,
  CONSTRAINT "completion_instance_family_fk"
    FOREIGN KEY ("activity_instance_id","family_id")
    REFERENCES "life_os"."activity_instances"("id","family_id") ON DELETE cascade
);

CREATE INDEX "completion_records_family_idx"
  ON "life_os"."completion_records" USING btree ("family_id","recorded_at");

CREATE TABLE "life_os"."domain_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "type" text NOT NULL,
  "aggregate_type" text NOT NULL,
  "aggregate_id" uuid NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "payload" jsonb NOT NULL,
  CONSTRAINT "domain_events_family_id_families_id_fk"
    FOREIGN KEY ("family_id") REFERENCES "life_os"."families"("id") ON DELETE cascade
);
