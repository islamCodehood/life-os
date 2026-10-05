CREATE TABLE "life_os"."activity_instances" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "child_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "available_from" timestamp with time zone NOT NULL,
  "target_at" timestamp with time zone NOT NULL,
  "opportunity_ends_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "activity_instances_family_pair_uidx" UNIQUE("id","family_id"),
  CONSTRAINT "activity_instances_assignment_target_uidx" UNIQUE("assignment_id","target_at"),
  CONSTRAINT "activity_instances_family_id_families_id_fk"
    FOREIGN KEY ("family_id") REFERENCES "life_os"."families"("id") ON DELETE cascade,
  CONSTRAINT "activity_instance_child_family_fk"
    FOREIGN KEY ("child_id","family_id")
    REFERENCES "life_os"."child_profiles"("id","family_id") ON DELETE cascade,
  CONSTRAINT "activity_instance_assignment_family_fk"
    FOREIGN KEY ("assignment_id","family_id")
    REFERENCES "life_os"."activity_assignments"("id","family_id") ON DELETE cascade
);

CREATE INDEX "activity_instances_child_target_idx"
  ON "life_os"."activity_instances" USING btree ("family_id","child_id","target_at");
