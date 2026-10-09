CREATE TABLE "life_os"."reminder_records" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "activity_instance_id" uuid NOT NULL,
  "source" text NOT NULL,
  "kind" text NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "attempted_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "acknowledged_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "reminder_records_family_id_families_id_fk"
    FOREIGN KEY ("family_id") REFERENCES "life_os"."families"("id") ON DELETE cascade,
  CONSTRAINT "reminder_instance_family_fk"
    FOREIGN KEY ("activity_instance_id","family_id")
    REFERENCES "life_os"."activity_instances"("id","family_id") ON DELETE cascade
);

CREATE UNIQUE INDEX "reminder_records_schedule_uidx"
  ON "life_os"."reminder_records" USING btree
  ("activity_instance_id","source","kind","scheduled_for");

CREATE INDEX "reminder_records_family_instance_idx"
  ON "life_os"."reminder_records" USING btree ("family_id","activity_instance_id");
