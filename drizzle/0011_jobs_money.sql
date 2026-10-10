-- E8: paid jobs and double-entry money for an internal educational wallet.
CREATE TABLE "life_os"."jobs" (
 "id" uuid PRIMARY KEY, "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "child_id" uuid NOT NULL, "title" text NOT NULL, "criteria" text NOT NULL,
 "payment_minor" bigint NOT NULL CHECK ("payment_minor">0),
 "currency" text NOT NULL, "status" text NOT NULL,
 "terms_version" integer NOT NULL DEFAULT 1, "accepted_terms_version" integer,
 "version" integer NOT NULL DEFAULT 1,
 "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "jobs_id_family_uidx" UNIQUE ("id","family_id"),
 CONSTRAINT "jobs_child_family_fk" FOREIGN KEY ("child_id","family_id") REFERENCES "life_os"."child_profiles"("id","family_id"),
 CONSTRAINT "jobs_status_check" CHECK ("status" IN
 ('OFFERED','ACCEPTED','IN_PROGRESS','SUBMITTED','NEEDS_REVISION','APPROVED','AWAITING_CREDIT','CREDITED','CANCELLED','CANCELLED_WITH_WORK')),
 CONSTRAINT "jobs_accepted_version_check" CHECK ("accepted_terms_version" IS NULL OR ("accepted_terms_version">0 AND "accepted_terms_version"<="terms_version"))
);
CREATE INDEX "jobs_child_idx" ON "life_os"."jobs"("family_id","child_id");
CREATE TABLE "life_os"."job_revisions" (
 "id" uuid PRIMARY KEY, "family_id" uuid NOT NULL, "job_id" uuid NOT NULL,
 "terms_version" integer NOT NULL, "criteria" text NOT NULL,
 "payment_minor" bigint NOT NULL CHECK ("payment_minor">0),
 "reason" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "job_revisions_job_fk" FOREIGN KEY ("job_id","family_id") REFERENCES "life_os"."jobs"("id","family_id"),
 CONSTRAINT "job_revisions_version_unique" UNIQUE ("job_id","terms_version")
);

CREATE TABLE "life_os"."money_accounts" (
 "id" uuid PRIMARY KEY, "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "child_id" uuid NOT NULL, "bucket" text NOT NULL, "currency" text NOT NULL,
 CONSTRAINT "money_accounts_child_bucket_uidx" UNIQUE ("family_id","child_id","bucket"),
 CONSTRAINT "money_accounts_pair_uidx" UNIQUE ("id","family_id","child_id"),
 CONSTRAINT "money_account_child_family_fk" FOREIGN KEY ("child_id","family_id") REFERENCES "life_os"."child_profiles"("id","family_id"),
 CONSTRAINT "money_bucket_check" CHECK ("bucket" IN ('UNALLOCATED','GIVE','SAVE','SPEND','EXTERNAL'))
);
CREATE TABLE "life_os"."money_transactions" (
 "id" uuid PRIMARY KEY, "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "child_id" uuid NOT NULL, "kind" text NOT NULL, "currency" text NOT NULL,
 "job_id" uuid, "correction_of" uuid, "note" text NOT NULL,
 "occurred_at" timestamptz NOT NULL, "recorded_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "money_transactions_pair_uidx" UNIQUE ("id","family_id","child_id"),
 CONSTRAINT "money_tx_child_family_fk" FOREIGN KEY ("child_id","family_id") REFERENCES "life_os"."child_profiles"("id","family_id"),
 CONSTRAINT "money_tx_job_family_fk" FOREIGN KEY ("job_id","family_id") REFERENCES "life_os"."jobs"("id","family_id"),
 CONSTRAINT "money_tx_correction_fk" FOREIGN KEY ("correction_of","family_id","child_id") REFERENCES "life_os"."money_transactions"("id","family_id","child_id"),
 CONSTRAINT "money_tx_kind_check" CHECK ("kind" IN ('JOB_INCOME','GIFT','ALLOWANCE','ALLOCATION','SPEND','GIVING','CORRECTION')),
 CONSTRAINT "money_tx_reference_check" CHECK (
 ("kind"='JOB_INCOME' AND "job_id" IS NOT NULL AND "correction_of" IS NULL) OR
 ("kind"='CORRECTION' AND "job_id" IS NULL AND "correction_of" IS NOT NULL) OR
 ("kind" NOT IN ('JOB_INCOME','CORRECTION') AND "job_id" IS NULL AND "correction_of" IS NULL))
);
CREATE UNIQUE INDEX "money_tx_one_credit_per_job" ON "life_os"."money_transactions"("job_id") WHERE "job_id" IS NOT NULL;
CREATE UNIQUE INDEX "money_tx_one_correction" ON "life_os"."money_transactions"("correction_of") WHERE "correction_of" IS NOT NULL;
CREATE INDEX "money_transactions_child_idx" ON "life_os"."money_transactions"("family_id","child_id","recorded_at");
CREATE TABLE "life_os"."money_postings" (
 "id" uuid PRIMARY KEY, "family_id" uuid NOT NULL, "child_id" uuid NOT NULL,
 "transaction_id" uuid NOT NULL, "account_id" uuid NOT NULL,
 "amount_minor" bigint NOT NULL CHECK ("amount_minor"<>0),
 CONSTRAINT "money_postings_tx_fk" FOREIGN KEY ("transaction_id","family_id","child_id")
 REFERENCES "life_os"."money_transactions"("id","family_id","child_id"),
 CONSTRAINT "money_postings_account_fk" FOREIGN KEY ("account_id","family_id","child_id")
 REFERENCES "life_os"."money_accounts"("id","family_id","child_id")
);
CREATE INDEX "money_postings_child_idx" ON "life_os"."money_postings"("family_id","child_id");

-- Deferred transaction-level balance check, including minimum 2 postings.
-- Inserts are performed in the same SQL transaction as the parent money_transaction.
CREATE OR REPLACE FUNCTION "life_os"."enforce_money_balance"() RETURNS trigger AS $$
DECLARE posting_count integer; total numeric;
BEGIN
 SELECT count(*),coalesce(sum("amount_minor"),0) INTO posting_count,total
 FROM "life_os"."money_postings" WHERE "transaction_id"=NEW."id";
 IF posting_count<2 OR total<>0 THEN
   RAISE EXCEPTION 'Money transaction % is not balanced (postings %, total %)', NEW."id",posting_count,total;
 END IF;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "money_transaction_balanced" AFTER INSERT ON "life_os"."money_transactions"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "life_os"."enforce_money_balance"();

CREATE OR REPLACE FUNCTION "life_os"."reject_money_history_mutation"() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Financial history is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "money_transactions_immutable" BEFORE UPDATE OR DELETE ON "life_os"."money_transactions"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_money_history_mutation"();
CREATE TRIGGER "money_postings_immutable" BEFORE UPDATE OR DELETE ON "life_os"."money_postings"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_money_history_mutation"();
CREATE TRIGGER "job_revisions_immutable" BEFORE UPDATE OR DELETE ON "life_os"."job_revisions"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_money_history_mutation"();

CREATE TABLE "life_os"."saving_goals" (
 "id" uuid PRIMARY KEY, "family_id" uuid NOT NULL REFERENCES "life_os"."families"("id") ON DELETE CASCADE,
 "child_id" uuid NOT NULL, "title" text NOT NULL,
 "target_minor" bigint NOT NULL CHECK ("target_minor">0),
 "status" text NOT NULL DEFAULT 'ACTIVE', "version" integer NOT NULL DEFAULT 1,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "saving_goals_pair_uidx" UNIQUE ("id","family_id","child_id"),
 CONSTRAINT "saving_goal_child_fk" FOREIGN KEY ("child_id","family_id") REFERENCES "life_os"."child_profiles"("id","family_id"),
 CONSTRAINT "saving_goal_status_check" CHECK ("status" IN ('ACTIVE','CLOSED'))
);
CREATE TABLE "life_os"."saving_goal_allocations" (
 "id" uuid PRIMARY KEY, "family_id" uuid NOT NULL, "child_id" uuid NOT NULL,
 "saving_goal_id" uuid NOT NULL, "amount_minor" bigint NOT NULL CHECK ("amount_minor">0),
 "created_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "saving_alloc_goal_fk" FOREIGN KEY ("saving_goal_id","family_id","child_id")
 REFERENCES "life_os"."saving_goals"("id","family_id","child_id")
);
CREATE TRIGGER "saving_allocations_immutable" BEFORE UPDATE OR DELETE ON "life_os"."saving_goal_allocations"
 FOR EACH ROW EXECUTE FUNCTION "life_os"."reject_money_history_mutation"();
