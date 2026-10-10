# E8 — Jobs & Money: Implementation status

Branch: `feat/e8-jobs-money-ledger`, PR #9.

## Implemented

### Jobs: agreement → work → guardian review → money
- Guardian creates a paid **extra-work Job**, never pays for ordinary responsibilities, values, faith, or XP.
- Child accepts explicit work criteria and payment in the family's currency, using integer **minor units**.
- Guardian changes to terms create an immutable `job_revisions` snapshot, increment `terms_version`, clear acceptance, and return to an offer. The original offer also gets a version-1 history snapshot.
- Job flow: OFFERED → ACCEPTED → IN_PROGRESS → SUBMITTED → AWAITING_CREDIT → CREDITED.
- Guardian may request rework (NEEDS_REVISION), or cancel (including CANCELLED_WITH_WORK after work begins).
- Guardian `ApproveJob` makes payment owed but **does not invent money**. `CreditApprovedJob` posts canonical income and marks job CREDITED atomically.
- The money service independently verifies the stored Job is AWAITING_CREDIT, accepted terms equal current terms, the child matches, and the amount matches the agreed payment.
- Unique `money_transactions.job_id` prevents double credit; job is row-locked/version checked within the same idempotent command transaction.

### Wallet: ownership ledger
- Canonical PostgreSQL `money_accounts`, `money_transactions`, `money_postings`. All money is `bigint` minor units; wire amounts are **decimal strings**, not floats.
- Accounts per child: **UNALLOCATED**, **GIVE**, **SAVE**, **SPEND**, and balancing EXTERNAL account.
- Server-authoritative commands for job income, gifts, allowance, Give / Save / Spend allocation, giving and spending.
- Allocation must exhaust the entire currently **unallocated** balance exactly (no negative or fractional amounts). Suggested editable defaults: **20% Give / 60% Save / 20% Spend**, in that order.
- Child private wallet read; parent family-scoped child wallet read. Wallet is an educational ownership record, not an actual bank account or physical custody model.
- Money operations acquire child-wallet PostgreSQL transaction advisory lock before reading balances; negative balances/overspend are rejected.
- Every posting batch balances to zero. A deferred PostgreSQL constraint trigger rejects transactions missing postings or failing to balance at commit. Triggers reject UPDATE/DELETE of financial transactions/postings (immutability).
- Guardian correction writes a **new balanced compensating transaction** with `correction_of`, never edits/deletes an original. A reversal requiring negative bucket balance or encumbered savings is blocked.

### Saving goals
- Guardian creates a child-specific saving intention and earmarks **existing SAVE funds**, preventing aggregate active earmarks exceeding SAVE balance.
- Closing a goal frees its earmark but **does not** move or spend the child's SAVE funds. Historical earmarks are append-only.
- No funds are deposited at a bank; saving-goal earmarks are just intentional allocations inside the existing SAVE bucket.

### UI + API
- Guardian job creation/review/approval/credit, revised terms, gift and allowance credits, allocation, giving/spending, saving goals and mistaken-transaction correction.
- Child sees own offered/active jobs, can accept/start/submit/restart, and sees only their own money/bucket/saving goals and history.
- English and Arabic text; money display always derives from confirmed server reads.
- `/api/v1/child/jobs`, `/api/v1/child/money`,
  `/api/v1/children/:childId/jobs` and `/api/v1/children/:childId/money` with explicit actor scoping.
- All mutations use the transactional, idempotent HTTP command envelope with server-derived actor context.

## E8 boundaries
- Child money autonomy permissions have not been persistently implemented. Financial edits default **guardian-only**, regardless of age. Children can manage their own job response and see their own ledger, not siblings' private wallets.
- No direct money-for-activities, XP-money conversions, sibling leaderboards or punishment deductions.
- No client-side optimistic authoritative money balances. **Financial actions require connectivity**; the existing E3 Dexie offline queue supports only `CompleteActivity`.
- Full physical money custody, bank integrations, arbitrary account transfers, and optional **partial compensation for cancelled work** remain out of scope. CANCELLED_WITH_WORK stays visible for guardian discussion.
- Real PostgreSQL migration/recovery tests require an actual configured DB and are not claimed by the unit/CI suite.
- The app role should be configured to withhold UPDATE/DELETE rights for financial history. E8 also protects transactions and postings via DB triggers in `0011_jobs_money.sql`.

## Required checks
- Typecheck, ESLint, formatting, domain/unit/integration tests.
- Production Next.js build and browser bundle guard.
- Playwright smoke.
- Real DB smoke/migration rehearsal separately where infrastructure permits.

## Relevant files
- `src/domain/jobs/job.ts`, `src/domain/money/ledger.ts`
- `src/application/jobs/*`, `src/application/money/*`
- `src/infrastructure/jobs/*`, `src/infrastructure/money/*`
- `src/infrastructure/database/schema/jobs-money.ts`, `drizzle/0011_jobs_money.sql`
- `src/ui/money/*`, `src/i18n/money-messages.ts`
- `tests/domain/job-rules.test.ts`, `tests/domain/money-ledger.test.ts`,
  `tests/unit/e8-jobs-money-service.test.ts`, `tests/unit/e8-money-migrations.test.ts`
