CREATE TABLE "life_os"."activity_definitions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "template_key" text,
  "title" text NOT NULL,
  "description" text,
  "why" text,
  "category" text NOT NULL,
  "created_by_guardian_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "activity_definitions_family_pair_uidx" UNIQUE("id","family_id"),
  CONSTRAINT "activity_definitions_family_id_families_id_fk"
    FOREIGN KEY ("family_id") REFERENCES "life_os"."families"("id") ON DELETE cascade,
  CONSTRAINT "activity_definitions_template_key_activity_templates_key_fk"
    FOREIGN KEY ("template_key") REFERENCES "life_os"."activity_templates"("key"),
  CONSTRAINT "activity_definition_guardian_family_fk"
    FOREIGN KEY ("family_id","created_by_guardian_id")
    REFERENCES "life_os"."family_guardians"("family_id","guardian_id")
);

CREATE INDEX "activity_definitions_family_idx"
  ON "life_os"."activity_definitions" USING btree ("family_id");

CREATE TABLE "life_os"."activity_assignments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "child_id" uuid NOT NULL,
  "activity_definition_id" uuid NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "schedule_rrule" text NOT NULL,
  "schedule_timezone" text NOT NULL,
  "local_target_time" text NOT NULL,
  "available_offset_minutes" integer NOT NULL,
  "opportunity_end_offset_minutes" integer NOT NULL,
  "tracking_mode" text NOT NULL,
  "completion_mode" text NOT NULL,
  "approval_mode" text NOT NULL,
  "progress_mode" text NOT NULL,
  "xp_mode" text NOT NULL,
  "xp_amount" integer,
  "reminder_policy" jsonb NOT NULL,
  "active_from" date NOT NULL,
  "active_until" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "activity_assignments_family_pair_uidx" UNIQUE("id","family_id"),
  CONSTRAINT "activity_assignments_family_id_families_id_fk"
    FOREIGN KEY ("family_id") REFERENCES "life_os"."families"("id") ON DELETE cascade,
  CONSTRAINT "activity_assignment_child_family_fk"
    FOREIGN KEY ("child_id","family_id")
    REFERENCES "life_os"."child_profiles"("id","family_id") ON DELETE cascade,
  CONSTRAINT "activity_assignment_definition_family_fk"
    FOREIGN KEY ("activity_definition_id","family_id")
    REFERENCES "life_os"."activity_definitions"("id","family_id") ON DELETE cascade
);

CREATE INDEX "activity_assignments_child_idx"
  ON "life_os"."activity_assignments" USING btree ("family_id","child_id");
