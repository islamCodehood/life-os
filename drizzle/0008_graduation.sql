CREATE TABLE "life_os"."graduation_evidence_snapshots" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "assignment_id" uuid NOT NULL,
  "captured_at" timestamptz DEFAULT now() NOT NULL,
  "metrics" jsonb NOT NULL,
  CONSTRAINT "graduation_evidence_assignment_fk" FOREIGN KEY ("assignment_id", "family_id")
    REFERENCES "life_os"."activity_assignments"("id", "family_id") ON DELETE CASCADE
);
CREATE INDEX "graduation_evidence_family_idx" ON "life_os"."graduation_evidence_snapshots"("family_id","assignment_id");

CREATE TABLE "life_os"."graduation_records" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "child_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'GRADUATED',
  "approved_at" timestamptz NOT NULL,
  "approved_by" uuid NOT NULL,
  "monitoring_interval_days" integer NOT NULL DEFAULT 14,
  "last_observed_at" timestamptz,
  "reactivated_at" timestamptz,
  "reactivated_by" uuid,
  CONSTRAINT "graduation_record_assignment_fk" FOREIGN KEY ("assignment_id", "family_id")
    REFERENCES "life_os"."activity_assignments"("id", "family_id") ON DELETE CASCADE,
  CONSTRAINT "graduation_record_child_fk" FOREIGN KEY ("child_id", "family_id")
    REFERENCES "life_os"."child_profiles"("id", "family_id") ON DELETE CASCADE,
  CONSTRAINT "graduation_record_guardian_fk" FOREIGN KEY ("family_id","approved_by")
    REFERENCES "life_os"."family_guardians"("family_id","guardian_id"),
  CONSTRAINT "graduation_record_interval_chk" CHECK ("monitoring_interval_days" BETWEEN 1 AND 90),
  CONSTRAINT "graduation_record_status_chk" CHECK ("status" IN ('GRADUATED','REACTIVATED'))
);
CREATE UNIQUE INDEX "graduation_one_active_per_assignment_uidx" ON "life_os"."graduation_records"("assignment_id")
  WHERE "status" = 'GRADUATED';
CREATE INDEX "graduation_record_child_idx" ON "life_os"."graduation_records"("family_id","child_id");

CREATE TABLE "life_os"."graduation_observations" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "graduation_record_id" uuid NOT NULL REFERENCES "life_os"."graduation_records"("id") ON DELETE CASCADE,
  "recorded_by" uuid NOT NULL,
  "result" text NOT NULL,
  "observed_at" timestamptz NOT NULL,
  "recorded_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "graduation_observation_guardian_fk" FOREIGN KEY ("family_id","recorded_by")
    REFERENCES "life_os"."family_guardians"("family_id","guardian_id"),
  CONSTRAINT "graduation_observation_result_chk" CHECK ("result" IN ('STABLE','SOMETIMES_NEEDS_HELP','NEEDS_REGULAR_SUPPORT'))
);
CREATE INDEX "graduation_observations_record_idx" ON "life_os"."graduation_observations"("family_id","graduation_record_id","observed_at");

CREATE TABLE "life_os"."graduation_suggestions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
  "child_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "graduation_record_id" uuid REFERENCES "life_os"."graduation_records"("id"),
  "evidence_snapshot_id" uuid REFERENCES "life_os"."graduation_evidence_snapshots"("id"),
  "kind" text NOT NULL,
  "origin" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "decided_at" timestamptz,
  "decided_by" uuid,
  CONSTRAINT "graduation_suggestion_assignment_fk" FOREIGN KEY ("assignment_id", "family_id")
    REFERENCES "life_os"."activity_assignments"("id", "family_id") ON DELETE CASCADE,
  CONSTRAINT "graduation_suggestion_child_fk" FOREIGN KEY ("child_id", "family_id")
    REFERENCES "life_os"."child_profiles"("id", "family_id") ON DELETE CASCADE,
  CONSTRAINT "graduation_suggestion_kind_chk" CHECK ("kind" IN ('GRADUATION','REACTIVATION')),
  CONSTRAINT "graduation_suggestion_origin_chk" CHECK ("origin" IN ('GUARDIAN_REVIEW','MONITORING_EVIDENCE')),
  CONSTRAINT "graduation_suggestion_status_chk" CHECK ("status" IN ('PENDING','ACCEPTED','DECLINED','SNOOZED'))
);
CREATE UNIQUE INDEX "graduation_one_pending_suggestion_uidx"
  ON "life_os"."graduation_suggestions"("assignment_id","kind")
  WHERE "status" = 'PENDING';
CREATE INDEX "graduation_suggestion_family_idx" ON "life_os"."graduation_suggestions"("family_id","child_id");

-- Terminal historical opportunities remain canonical. No existing completions are deleted.
