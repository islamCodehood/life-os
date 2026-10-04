---
title: "Life OS for Kids - Implementation Specification"
subtitle: "Final Consolidated Specification V2.0-V2.3"
author: "Implementation-ready engineering contract"
date: "3 October 2026"
---

# Document purpose

This document consolidates **Implementation Specification V2.0 through V2.3** for Life OS for Kids. It translates the frozen System Design V0.1-V0.4 and System Architecture V1.0-V1.3 into an implementation contract that a software engineer or coding agent can execute without inventing product behavior or architecture.

This document answers four questions:

1. **V2.0 - Build Blueprint:** In what order should the product be built, and what implementation boundaries are mandatory?
2. **V2.1 - Domain & Persistence Implementation:** What concrete TypeScript/domain, PostgreSQL/Drizzle, ledger, repository, migration, event, and transaction structures should be implemented?
3. **V2.2 - API & Offline Client Implementation:** What commands, read models, HTTP contracts, local IndexedDB records, sync behavior, optimistic rules, and conflict handlers should exist?
4. **V2.3 - Delivery & Coding-Agent Specification:** How should work be sliced, tested, deployed, configured, reviewed, and handed to AI coding agents?

The governing implementation rule is:

> **Do not invent business rules while coding. Implement the System Design and Architecture as written; when a rule is missing, stop at the boundary and record the decision rather than silently creating a new behavior.**

A second rule is equally important:

> **Every meaningful implementation slice must work end-to-end: UI -> durable local intent -> API -> authorization -> domain -> PostgreSQL -> read model -> tests.**

# Specification status

**Final consolidated package.** This edition incorporates the approved V2.0 Build Blueprint and the completed V2.1 Domain & Persistence, V2.2 API & Offline Client, and V2.3 Delivery & Coding-Agent specifications.


| Version | Scope | Status |
|---|---|---|
| V2.0 | Repository, toolchain, boundaries, vertical-slice strategy, implementation sequence | Frozen implementation baseline |
| V2.1 | Domain objects, Drizzle/PostgreSQL schemas, repositories, transactions, ledgers, events, migrations | Frozen MVP persistence contract |
| V2.2 | Commands, query/read models, API DTOs, ActorResolver, error mapping, Dexie, sync, conflicts, service worker | Frozen MVP client/server contract |
| V2.3 | Delivery plan, stories, acceptance criteria, environments, CI/CD, release gates, agent instructions, master prompt | Frozen delivery baseline; operational values remain configurable |

# 1. Verified implementation baseline

The implementation baseline as of **3 October 2026** is:

| Concern | Baseline |
|---|---|
| Runtime | Node.js 24 LTS for the initial repository; review Node 26 LTS after its October 2026 promotion and project compatibility checks |
| Framework | Next.js 16 active-LTS line, pinned to the current security-patched release at bootstrap |
| React | Version supported by the selected Next.js 16 release |
| Language | TypeScript strict mode |
| Package manager | pnpm |
| Database | Supabase PostgreSQL |
| ORM | Drizzle ORM |
| PostgreSQL driver | `pg` / node-postgres |
| Guardian authentication | Supabase Auth through an application adapter |
| Runtime validation | Zod |
| Client server-state | TanStack Query v5 |
| Durable offline database | Dexie over IndexedDB |
| Forms | React Hook Form + Zod |
| Unit/application tests | Vitest |
| Browser/end-to-end tests | Playwright |
| Hosting | Vercel |
| CI | GitHub Actions + Vercel preview/prod deployments |
| Database migrations | Drizzle Kit plus reviewed SQL for constraints/triggers/privileges that are clearer in SQL |

**Version policy:** never commit `latest` for critical runtime dependencies. Bootstrap with the approved stable/LTS versions, generate `pnpm-lock.yaml`, commit it, and upgrade intentionally.

```text
Patch update
  -> routine dependency PR + CI

Minor update
  -> release notes review + CI + offline/E2E smoke

Major update
  -> explicit migration task + ADR if architecture changes
```

# 2. V2.0 - Build Blueprint

## 2.1 Repository topology

Use one repository and one deployable modular monolith for the MVP.

```text
life-os/
|
+-- app/
|   +-- (public)/
|   +-- (app)/
|   |   +-- parent/
|   |   +-- child/
|   +-- api/
|   |   +-- v1/
|   |   +-- internal/
|   +-- manifest.ts
|   +-- layout.tsx
|
+-- src/
|   +-- modules/
|   |   +-- family/
|   |   +-- activities/
|   |   +-- progress/
|   |   +-- goals/
|   |   +-- jobs/
|   |   +-- money/
|   |   +-- moments/
|   |   +-- autonomy/
|   |   +-- reviews/
|   |   +-- visual-world/
|   +-- application/
|   |   +-- commands/
|   |   +-- queries/
|   |   +-- auth/
|   +-- domain/
|   |   +-- shared/
|   |   +-- policies/
|   +-- infrastructure/
|   |   +-- database/
|   |   +-- auth/
|   |   +-- push/
|   |   +-- scheduler/
|   |   +-- logging/
|   +-- offline/
|   |   +-- db/
|   |   +-- outbox/
|   |   +-- sync/
|   |   +-- conflicts/
|   +-- ui/
|   |   +-- primitives/
|   |   +-- patterns/
|   |   +-- providers/
|   +-- i18n/
|   +-- shared/
|
+-- drizzle/
+-- public/themes/island/
+-- tests/
|   +-- domain/
|   +-- application/
|   +-- integration/
|   +-- offline/
|   +-- e2e/
+-- docs/
+-- scripts/
+-- drizzle.config.ts
+-- next.config.ts
+-- playwright.config.ts
+-- vitest.config.ts
+-- tsconfig.json
+-- package.json
```

## 2.2 Dependency direction

The dependency rule is mandatory:

```text
Presentation / UI
        |
Application commands + queries
        |
Domain entities + policies
        |
Repository / gateway interfaces
        ^
Infrastructure implementations
        |
PostgreSQL / Auth / Push / Clock / Dexie
```

The pure domain layer must not import React, Next.js, Drizzle, Supabase, Dexie, Vercel, Web Push, or browser APIs.

## 2.3 Module implementation convention

A feature module should normally contain domain, application, infrastructure adapter, API contract, and UI integration files close to that feature.

```text
src/modules/activities/
  domain/
    activity.ts
    activity-instance.ts
    activity-policy.ts
    activity-events.ts
    activity-errors.ts
  application/
    create-activity.ts
    complete-activity.ts
    correct-activity.ts
    archive-activity.ts
  infrastructure/
    drizzle-activity-repository.ts
  api/
    schemas.ts
    dto.ts
  ui/
    ActivityCard.tsx
    activity-hooks.ts
```

Avoid generic dumping-ground files such as `services.ts`, `helpers.ts`, or `utils.ts` when the code has a clear domain home.

## 2.4 Primitive types

Use branded IDs at compile time and UUID values at runtime.

```ts
type Brand<T, Name extends string> = T & { readonly __brand: Name }

type FamilyId = Brand<string, 'FamilyId'>
type ChildId = Brand<string, 'ChildId'>
type GuardianId = Brand<string, 'GuardianId'>
type CommandId = Brand<string, 'CommandId'>
type ActivityAssignmentId = Brand<string, 'ActivityAssignmentId'>
type ActivityInstanceId = Brand<string, 'ActivityInstanceId'>
type GoalId = Brand<string, 'GoalId'>
type JobId = Brand<string, 'JobId'>
type MoneyTransactionId = Brand<string, 'MoneyTransactionId'>
```

Use application-generated UUIDv7 values so offline-created resources do not require server ID remapping.

## 2.5 Time types

API and cross-layer contracts use ISO strings, not JavaScript `Date` objects.

```ts
type IsoInstant = Brand<string, 'IsoInstant'>
type IsoDate = Brand<string, 'IsoDate'>
type IanaTimezone = Brand<string, 'IanaTimezone'>
```

Preserve the distinctions:

```text
occurredAt  = when real life happened
recordedAt  = when the system learned it
effectiveFrom = when a configuration becomes effective
```

Persist timestamps in UTC and interpret recurring schedules using an IANA timezone such as `Africa/Cairo`.

## 2.6 Money type

Money must never use floating-point values.

```ts
type Money = {
  amountMinor: bigint
  currency: string
}
```

JSON DTOs serialize `bigint` values as decimal strings:

```json
{
  "amountMinor": "4050",
  "currency": "EGP"
}
```

## 2.7 Actor context

Every command/query is evaluated under a server-resolved actor.

```ts
type ActorContext =
  | {
      kind: 'GUARDIAN'
      familyId: FamilyId
      guardianId: GuardianId
      deviceId?: string
    }
  | {
      kind: 'CHILD'
      familyId: FamilyId
      childId: ChildId
      deviceId: string
    }
  | {
      kind: 'SYSTEM'
      familyId?: FamilyId
    }
```

`ActorContext` must never be accepted as trusted request-body data.

## 2.8 Command envelope

All mutations use one durable envelope.

```ts
type ExpectedVersion = {
  resourceType: string
  resourceId: string
  version: number
}

type CommandEnvelope<TType extends string, TPayload> = {
  commandId: CommandId
  schemaVersion: 1
  type: TType
  occurredAt: IsoInstant
  clientSequence?: number
  expectedVersions?: ExpectedVersion[]
  payload: TPayload
}
```

Example:

```ts
type CompleteActivityCommand = CommandEnvelope<
  'CompleteActivity',
  { activityInstanceId: ActivityInstanceId }
>
```

The client does not send XP amount, money amount to be awarded, semantic meaning, autonomy readiness, or trusted child/family identity unless that value is part of the resource being selected rather than the actor identity.

## 2.9 Implementation layering tests

Add architecture tests or lint rules that prevent these imports:

```text
domain -> infrastructure

domain -> app/*

domain -> React / Next.js

client UI -> direct Drizzle database

browser code -> private PostgreSQL connection
```

## 2.10 Vertical slices

Do not build horizontal layers for months. Build one behavior all the way through.

```text
Slice 0  Foundation
Slice 1  Family + child identity
Slice 2  One responsibility end-to-end
Slice 3  Offline completion + replay
Slice 4  Reminder / independence / recovery
Slice 5  Graduation
Slice 6  Growth + XP
Slice 7  Goals
Slice 8  Jobs + money
Slice 9  Moments + story
Slice 10 Visual World
Slice 11 Weekly Review
Slice 12 Notifications + scheduling
Slice 13 Pilot hardening
```

The first useful pilot begins after Slice 4, not after the entire product is complete.

# 3. V2.1 - Domain & Persistence Implementation

## 3.1 Database schema and role setup

Use a private PostgreSQL schema:

```sql
CREATE SCHEMA IF NOT EXISTS life_os;
```

The runtime uses a dedicated database role such as `life_os_api`, not the PostgreSQL owner/superuser. The browser never receives credentials capable of accessing the private schema.

The runtime connection uses Supabase's transaction pooler. Migration tooling uses the migration/direct connection configured separately.

## 3.2 Shared database column conventions

Mutable aggregate-root tables normally contain:

```text
id            uuid primary key
family_id     uuid not null        -- for tenant-owned data
created_at    timestamptz not null
updated_at    timestamptz not null
version       integer not null default 1
archived_at   timestamptz null     -- where archive semantics apply
```

Append-only ledger/event tables do not need optimistic versions.

## 3.3 Drizzle schema organization

```text
src/infrastructure/database/schema/
  identity.ts
  activities.ts
  progress.ts
  goals.ts
  jobs.ts
  money.ts
  moments.ts
  autonomy.ts
  reviews.ts
  visualWorld.ts
  system.ts
  relations.ts
  indexes.ts
```

Export a single schema barrel only for Drizzle initialization. Domain/application code imports repository interfaces, not Drizzle table objects.

## 3.4 Representative Drizzle: families and children

```ts
export const families = lifeOs.table('families', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  weeklyReviewDay: smallint('weekly_review_day'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  version: integer('version').notNull().default(1),
})

export const childProfiles = lifeOs.table(
  'child_profiles',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id').notNull(),
    displayName: text('display_name').notNull(),
    birthDate: date('birth_date').notNull(),
    avatarKey: text('avatar_key'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    unique('child_family_pair').on(t.id, t.familyId),
    index('child_family_idx').on(t.familyId),
  ],
)
```

Exact Drizzle API spelling should follow the pinned repository version; the structure and constraints are the specification.

## 3.5 Identity tables

Implement these tables first:

| Table | Purpose |
|---|---|
| `families` | Family tenant root |
| `guardian_profiles` | Domain profile mapped to Supabase Auth user |
| `family_guardians` | Guardian membership and OWNER/GUARDIAN role |
| `child_profiles` | Child domain profiles |
| `experience_preferences` | Visualization/motion/theme selections |
| `household_devices` | Trusted family devices |
| `child_pin_credentials` | Argon2id PIN hashes and lockout state |
| `child_sessions` | Opaque device-bound child sessions |

Child sessions store only `token_hash`; the raw session token is only placed in a secure HttpOnly cookie.

## 3.6 Activity tables

Implement:

```text
activity_templates
activity_definitions
activity_assignments
activity_instances
completion_records
reminder_records
activity_corrections
pause_windows
```

### `activity_definitions`

Authoritative fields:

```text
id
family_id
template_id nullable
title
description
why
category
created_by_guardian_id
created_at
updated_at
version
archived_at
```

### `activity_assignments`

```text
id
family_id
child_id
activity_definition_id
status
schedule_rrule
schedule_timezone
local_target_time
available_offset_minutes
opportunity_end_offset_minutes
tracking_mode
completion_mode
approval_mode
progress_mode
xp_mode
xp_amount nullable
reminder_policy jsonb
active_from
active_until nullable
created_at
updated_at
version
archived_at nullable
```

The money policy is not configurable for ordinary activities because paid work uses the Jobs domain.

### `activity_instances`

```text
id
family_id
child_id
assignment_id
available_from
target_at
opportunity_ends_at
status
created_at
updated_at
version
```

Statuses:

```text
PENDING
COMPLETED
AWAITING_RESOLUTION
MISSED
EXCUSED
NOT_APPLICABLE
```

Unique constraint:

```text
(assignment_id, target_at)
```

This makes recurring-instance materialization idempotent.

## 3.7 Opportunity-window implementation

Recurring activities are materialized from:

```text
RRULE
+ schedule timezone
+ local target time
+ available offset
+ opportunity-end offset
```

For example:

```text
Target      07:30
Available   -90 minutes -> 06:00
Ends        +150 minutes -> 10:00
```

A completion at 00:20 can still belong to the previous evening's instance if it falls inside that instance's opportunity window. Calendar-day comparison is not sufficient.

## 3.8 Completion records

`completion_records` contains:

```text
id
family_id
activity_instance_id unique
occurred_at
recorded_at
reported_by_kind
reported_by_id nullable
self_initiated
reminder_count_at_completion
source
```

A guardian backfill preserves both times:

```text
occurred_at = yesterday
recorded_at = today
```

A guardian-recorded completion never automatically becomes self-initiated evidence.

## 3.9 Reminder records

Persist:

```text
source
kind
scheduled_for
attempted_at nullable
delivered_at nullable
acknowledged_at nullable
```

Do not infer `delivered` from `attempted`, or `acknowledged` from `delivered`.

## 3.10 Activity corrections

Corrections append a record and recompute derived effects. They do not erase original audit history.

```text
previous_status
new_status
reason
corrected_by_kind
corrected_by_id
created_at
```

An erroneous XP grant can be corrected; XP is never removed as punishment.

## 3.11 Policy engine implementation

Create one central activity-policy registry, not policy conditionals scattered across handlers.

```ts
type ActivityCategory =
  | 'SELF_RESPONSIBILITY'
  | 'FAMILY_RESPONSIBILITY'
  | 'GROWTH'
  | 'VALUES'
  | 'FAITH'

type PolicyDecision = {
  progressMode: string
  xp: 'FORBIDDEN' | 'TRAINING_ONLY' | 'ALLOWED'
  money: 'FORBIDDEN'
  approvalDefault: string
  graduationEligible: boolean
}
```

Hard domain invariants include:

```text
VALUES -> XP forbidden, money forbidden
FAITH -> XP forbidden, money forbidden
FAMILY_RESPONSIBILITY -> money forbidden
GROWTH -> money forbidden; skill XP may be allowed
SELF_RESPONSIBILITY -> money forbidden; training XP may be temporary
```

Paid work exists only as `Job`.

## 3.12 XP ledger

Implement append-only:

```text
xp_ledger
  id
  family_id
  child_id
  skill_key
  entry_type      GRANT | CORRECTION
  amount
  source_event_id
  correction_of nullable
  occurred_at
  recorded_at
```

Rules:

```text
GRANT amount > 0
CORRECTION must reference an existing erroneous entry
no PUNISHMENT entry type
no money conversion
```

`skill_progress` is a rebuildable projection of the ledger, not the authority.

## 3.13 Goals persistence

Implement:

```text
goals
goal_progress_entries
goal_revisions
```

`goals.owner_type` is `CHILD` or `FAMILY`; a family-owned goal is the implementation of SharedGoal.

Goal status values:

```text
DRAFT
AWAITING_APPROVAL
ACTIVE
PAUSED
TARGET_DATE_REACHED
ACHIEVED
CLOSED
```

Do not use `FAILED` as a goal status.

Goal target revisions append `goal_revisions`; prior targets remain historical truth.

## 3.14 Job persistence

Implement:

```text
jobs
job_revisions
```

Important fields:

```text
payment_minor
currency
completion_criteria jsonb
status
terms_version
accepted_terms_version
```

Statuses:

```text
OFFERED
ACCEPTED
IN_PROGRESS
SUBMITTED
NEEDS_REVISION
APPROVED
AWAITING_CREDIT
CREDITED
CANCELLED
CANCELLED_WITH_WORK
```

Every terms change increments `terms_version` and creates a snapshot in `job_revisions`. If the child accepted version 3 and the guardian changes to version 4, the job is not treated as accepted under the new terms until the child explicitly acknowledges them.

## 3.15 Money ledger: double-entry implementation

Use three tables:

```text
money_accounts
money_transactions
money_postings
```

Child-owned bucket account types:

```text
UNALLOCATED
GIVE
SAVE
SPEND
```

System/counterparty accounts balance external flows.

### Income example

100 EGP job income:

```text
UNALLOCATED   +10000 minor units
EXTERNAL      -10000 minor units
```

### Allocation example

```text
UNALLOCATED   -10000
GIVE            +1000
SAVE            +4000
SPEND           +5000
```

### Spend example

```text
SPEND           -2000
EXTERNAL         +2000
```

Every transaction must balance to zero before commit.

## 3.16 Money domain service

All money postings go through one application/domain service:

```ts
interface MoneyLedgerService {
  creditIncome(...): Promise<MoneyTransactionId>
  allocate(...): Promise<MoneyTransactionId>
  spend(...): Promise<MoneyTransactionId>
  give(...): Promise<MoneyTransactionId>
  correct(...): Promise<MoneyTransactionId>
}
```

No handler writes `money_postings` directly outside this service/repository boundary.

## 3.17 Append-only money protection

The normal runtime role receives INSERT/SELECT permissions required for ledger tables but does not receive ordinary UPDATE/DELETE privileges on historical postings/transactions.

A correction creates a new balanced transaction with `correction_of` pointing at the corrected transaction.

A database trigger or restricted stored procedure may additionally reject UPDATE/DELETE for defense in depth.

## 3.18 Saving goals

`SavingGoal` tracks intention, not ownership. Money remains in the child's SAVE bucket even when a saving goal is closed.

```text
saving_goals
saving_goal_allocations (optional mapping/projection)
```

Closing a goal must never silently move money to SPEND.

## 3.19 Moments persistence

Implement:

```text
moments
moment_tags
```

There are deliberately no columns named:

```text
score
points
moral_level
kindness_percent
```

Moments may be revised/archived with audit history but do not produce XP or money.

## 3.20 Autonomy and suggestion persistence

Implement:

```text
autonomy_domains
evidence_snapshots
suggestions
graduation_records
parent_observations
```

Autonomy states:

```text
PARENT_LED
SHARED
CHILD_LED
SELF_MANAGED
```

Suggestion statuses:

```text
PENDING
ACCEPTED
DECLINED
SNOOZED
```

The analysis job may create a suggestion but must never directly update `autonomy_domains.state` or graduate an activity.

## 3.21 Evidence snapshots

Persist transparent evidence, not opaque readiness scores.

Example JSON:

```json
{
  "opportunities": 20,
  "independent": 18,
  "externalReminders": 2,
  "misses": 2,
  "recoveredNextOpportunity": 2,
  "dataCoverage": 0.95
}
```

The parent UI should be able to explain a suggestion from this snapshot.

## 3.22 Graduation persistence

`graduation_records` stores:

```text
activity_assignment_id
status
suggested_at
approved_at
approved_by
monitoring_interval_days
last_observed_at
```

`parent_observations.result` values:

```text
STABLE
SOMETIMES_NEEDS_HELP
NEEDS_REGULAR_SUPPORT
```

One weak observation creates monitoring evidence, not an automatic reactivation.

## 3.23 Weekly review persistence

Implement:

```text
weekly_reviews
weekly_review_entries
```

There is one weekly review per family/week. Skipping a review creates no child penalty and no family streak loss.

## 3.24 Visual-world persistence

Persist semantic unlocks, not theme-specific pixels.

```text
world_unlocks
  id
  family_id
  child_id nullable
  world_scope          PERSONAL | FAMILY
  semantic_dimension
  milestone_key
  source_event_id
  unlocked_at
```

Unique source/milestone constraints prevent duplicate visual unlocks.

Do not store `tree.svg`, x/y coordinates, or animation names as domain truth.

## 3.25 Processed commands

Implement:

```text
processed_commands
  command_id primary key
  family_id
  actor_kind
  actor_id nullable
  device_id nullable
  command_type
  request_hash
  status
  result_summary jsonb nullable
  processed_at
```

Idempotency logic:

```text
same command ID + same hash
  -> return previous result

same command ID + different hash
  -> IDEMPOTENCY_KEY_REUSE
```

## 3.26 Domain events

Implement append-only `domain_events`:

```text
id
family_id
aggregate_type
aggregate_id
aggregate_version nullable
event_type
payload jsonb
occurred_at
recorded_at
actor_kind
actor_id nullable
causation_command_id nullable
```

The project is not full event sourcing. Current-state tables remain canonical for current state.

## 3.27 Transactional outbox

Implement:

```text
outbox_messages
  id
  family_id nullable
  domain_event_id nullable
  message_type
  payload jsonb
  status
  attempt_count
  available_at
  locked_at nullable
  last_error nullable
  created_at
  processed_at nullable
```

Statuses:

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

Consumers initially include:

```text
SEND_PUSH
RECALCULATE_METRICS
CREATE_VISUAL_UNLOCK
```

Use `FOR UPDATE SKIP LOCKED` when claiming queue rows.

## 3.28 Audit log

Audit sensitive administrative changes:

```text
actor_kind
actor_id
action
resource_type
resource_id
before_data
after_data
request_id
created_at
```

High-value audit actions include money corrections, autonomy changes, graduation decisions, job-term changes, activity-policy changes, guardian changes, and device revocation.

Do not log child PINs, raw session tokens, or unnecessary sensitive Moment content.

## 3.29 Repository interfaces

Repositories are family-scoped by construction.

```ts
interface ActivityRepository {
  getInstanceForUpdate(
    familyId: FamilyId,
    instanceId: ActivityInstanceId,
  ): Promise<ActivityInstance | null>

  saveInstance(
    familyId: FamilyId,
    instance: ActivityInstance,
    expectedVersion: number,
  ): Promise<void>

  appendCompletion(record: CompletionRecord): Promise<void>
}
```

No public method such as `findById(id)` is allowed on tenant-owned repositories unless the tenant is structurally encoded in the repository instance itself.

## 3.30 Unit of Work

One command is normally one PostgreSQL transaction.

```ts
interface UnitOfWork {
  transaction<T>(
    work: (repos: TransactionRepositories) => Promise<T>,
  ): Promise<T>
}
```

The `UnitOfWork` implementation supplies transaction-bound repositories using the same `pg`/Drizzle transaction.

## 3.31 Optimistic concurrency

Mutable aggregate roots use integer versions.

Conceptual update:

```sql
UPDATE life_os.activity_assignments
SET
  ...,
  version = version + 1
WHERE
  family_id = $1
  AND id = $2
  AND version = $3;
```

Zero affected rows becomes `STALE_VERSION` after distinguishing not-found from version conflict.

Use optimistic versioning for configuration and mutable aggregate roots such as ActivityAssignment, Goal, Job, AutonomyDomain, ExperiencePreferences, SavingGoal, and FamilyRule.

Do not use it for append-only events/ledgers.

## 3.32 Command handler transaction pattern

Example `CompleteActivity`:

```text
BEGIN
  verify command idempotency
  load instance scoped to family
  authorize actor
  validate state and occurrence time
  calculate reminder/self-initiation context
  insert completion
  update instance state/version
  write XP ledger only if policy permits
  append ActivityCompleted domain event
  enqueue metric/world side effects where needed
  insert processed_commands result
COMMIT
```

Either the complete domain mutation succeeds or none of it does.

## 3.33 Migration order

Recommended initial migration sequence:

```text
0001_extensions_and_schema.sql
0002_database_roles.sql
0003_family_identity.sql
0004_devices_and_child_sessions.sql
0005_activity_templates.sql
0006_activities.sql
0007_activity_instances.sql
0008_completion_and_reminders.sql
0009_progress_and_xp.sql
0010_goals.sql
0011_jobs.sql
0012_money_ledger.sql
0013_moments.sql
0014_autonomy_and_graduation.sql
0015_weekly_reviews.sql
0016_visual_world.sql
0017_processed_commands.sql
0018_domain_events.sql
0019_outbox.sql
0020_audit_log.sql
0021_indexes.sql
0022_append_only_protection.sql
```

Keep migrations small, forward-only, version-controlled, and reviewable.

## 3.34 Seed data vs migrations

Migrations create schema. A separate seed process creates product defaults:

```text
activity templates
starter packs
age-profile defaults
visualization defaults
policy defaults
suggestion thresholds
visual milestone definitions
```

Use stable keys such as:

```text
SELF_MAKE_BED
SELF_PREPARE_SCHOOL_BAG
GROWTH_READING
GROWTH_CHESS_PRACTICE
```

Titles/translations are presentation data, not identifiers.

## 3.35 V2.1 mandatory persistence tests

Before V2.1 is complete, tests must prove:

```text
cross-family foreign relationships rejected
one completion per activity instance
one recurring instance per occurrence
money postings balance to zero
money transactions cannot be silently modified/deleted
XP correction is auditable
same command cannot apply twice
same idempotency key with changed payload is rejected
stale aggregate update returns conflict
job accepted terms cannot silently mutate
world unlock cannot duplicate for same source/milestone
outbox workers cannot claim the same message concurrently
```

# 4. V2.2 - API & Offline Client Implementation

## 4.1 API philosophy

Use:

```text
REST-style purpose-built query endpoints
+
one generic command mutation endpoint
+
one offline command batch endpoint
```

Do not expose generic CRUD over domain tables.

## 4.2 Route Handler responsibility

Route handlers remain thin:

```text
parse HTTP request
resolve ActorContext
validate Zod schema
dispatch command/query
map typed error
return safe DTO
```

Business rules never live in `route.ts`.

## 4.3 Command endpoint

```http
POST /api/v1/commands
```

Request:

```json
{
  "commandId": "019a...",
  "schemaVersion": 1,
  "type": "CompleteActivity",
  "occurredAt": "2026-10-03T06:42:00Z",
  "clientSequence": 17,
  "expectedVersions": [
    {
      "resourceType": "ActivityInstance",
      "resourceId": "019a...",
      "version": 2
    }
  ],
  "payload": {
    "activityInstanceId": "019a..."
  }
}
```

## 4.4 Command response

```json
{
  "commandId": "019a...",
  "status": "ACCEPTED",
  "serverTime": "2026-10-03T15:45:12Z",
  "resourceVersions": [
    {
      "resourceType": "ActivityInstance",
      "resourceId": "019a...",
      "version": 3
    }
  ],
  "effects": [
    {
      "type": "INDEPENDENCE_PROGRESS"
    }
  ]
}
```

`effects` are presentation-safe semantic effects. They are not trusted client decisions and are not a substitute for refetching canonical read models.

## 4.5 Command dispatcher

```ts
interface CommandDispatcher {
  dispatch(
    actor: ActorContext,
    command: SupportedCommand,
  ): Promise<CommandResult>
}
```

A registry maps command types to handlers. Unknown command types return `VALIDATION_FAILED`/unsupported command without dynamic module loading from request strings.

## 4.6 Command catalog - identity/profile

Initial commands:

```text
CreateFamily
UpdateFamilySettings
CreateChildProfile
UpdateChildProfile
UpdateExperiencePreferences
RegisterHouseholdDevice
RevokeHouseholdDevice
SetChildPin
ResetChildPin
```

Guardian-only authorization applies to family/device/PIN administration.

## 4.7 Command catalog - activities

```text
CreateActivityAssignment
UpdateActivityAssignment
ArchiveActivityAssignment
CompleteActivity
UndoRecentCompletion
CorrectActivityRecord
ExcuseActivity
MarkActivityMissed
MarkActivityNotApplicable
PauseActivities
ResumeActivities
```

The server decides whether child undo is still inside the child self-correction window; otherwise guardian correction is required.

## 4.8 Command catalog - goals

```text
CreateGoal
ApproveGoal
RequestGoalRevision
UpdateGoal
PauseGoal
ResumeGoal
AddGoalProgress
AchieveGoal
CloseGoal
RecordGoalReflection
```

Approval requirements are derived from the child's autonomy state, not from client UI assumptions.

## 4.9 Command catalog - jobs

```text
CreateJob
AcceptJob
AcceptRevisedJobTerms
StartJob
SubmitJob
RequestJobRevision
ApproveJob
CreditApprovedJob
CancelJob
RecordPartialCompensation
```

Default MVP can credit the app ledger automatically on `ApproveJob`, but the state model retains `AWAITING_CREDIT` so manual credit mode remains possible.

## 4.10 Command catalog - money

```text
RecordGiftIncome
RecordAllowanceIncome
AllocateMoney
RecordSpend
RecordGiving
TransferSavingsAllocation
CreateSavingGoal
UpdateSavingGoal
CloseSavingGoal
CorrectMoneyTransaction
```

There is deliberately no `DeleteMoneyTransaction` command.

## 4.11 Command catalog - moments/reviews

```text
RecordMoment
UpdateMoment
ArchiveMoment
StartWeeklyReview
SaveWeeklyReviewEntry
CompleteWeeklyReview
SkipWeeklyReview
```

Moment commands never accept XP or money payloads.

## 4.12 Command catalog - autonomy/graduation

```text
ReviewAutonomySuggestion
ApproveAutonomyChange
DeclineAutonomyChange
SnoozeSuggestion
ApproveGraduation
DeclineGraduation
RecordGraduatedObservation
ApproveReactivation
DeclineReactivation
```

There is deliberately no child command for approving their own autonomy or graduation.

## 4.13 ActorResolver

Create one server service:

```ts
interface ActorResolver {
  resolve(request: Request): Promise<ActorContext | null>
}
```

Resolution order should be explicit and tested. A child-scoped active session on a trusted device must not accidentally inherit guardian permissions merely because a guardian session cookie also exists.

Recommended behavior:

```text
explicit parent-unlock context -> guardian actor
else active child-session cookie -> child actor
else valid guardian session -> guardian actor
else unauthenticated
```

Route groups can restrict acceptable actor kinds further.

## 4.14 Authorization service

Create purpose-specific methods rather than a generic string ACL everywhere.

```ts
interface AuthorizationService {
  canViewChild(actor, childId): Promise<boolean>
  canManageActivity(actor, childId): Promise<boolean>
  canCompleteActivity(actor, instance): Promise<boolean>
  canAllocateMoney(actor, childId): Promise<boolean>
  canApproveJob(actor, job): Promise<boolean>
  canApproveAutonomy(actor, childId): Promise<boolean>
}
```

Child money/goal actions consult current autonomy where relevant.

## 4.15 Standard error DTO

```json
{
  "error": {
    "code": "STALE_VERSION",
    "message": "This activity changed on another device.",
    "details": {},
    "requestId": "019a..."
  }
}
```

Core mapping:

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Request structure invalid |
| 401 | `AUTH_REQUIRED` | No valid actor/session |
| 403 | `FORBIDDEN` | Actor cannot perform action |
| 404 | `RESOURCE_NOT_FOUND` | Missing or deliberately concealed resource |
| 409 | `STALE_VERSION` | Mutable aggregate changed |
| 409 | `IDEMPOTENCY_KEY_REUSE` | Same command ID, different body |
| 409 | `RESOURCE_STATE_CHANGED` | Offline action no longer valid in current/effective state |
| 409 | `JOB_TERMS_CHANGED` | Accepted terms are outdated |
| 422 | `DOMAIN_RULE_VIOLATION` | Valid syntax, invalid business action |
| 422 | `INSUFFICIENT_FUNDS` | Money constraint |
| 429 | `RATE_LIMITED` | PIN/auth/abuse throttling |
| 426 | `CLIENT_UPDATE_REQUIRED` | Client command/API schema is no longer compatible |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |

Do not leak stack traces or sibling resource existence in public messages.

## 4.16 Read endpoint catalog - child

Initial read models:

```text
GET /api/v1/bootstrap
GET /api/v1/child/home
GET /api/v1/child/today
GET /api/v1/child/journey
GET /api/v1/child/goals
GET /api/v1/child/jobs
GET /api/v1/child/money
GET /api/v1/child/story
GET /api/v1/child/graduated
GET /api/v1/family/world
GET /api/v1/family/shared-goals
```

These return presentation-ready read models, not database rows.

## 4.17 Read endpoint catalog - parent

```text
GET /api/v1/parent/home
GET /api/v1/children/:childId/overview
GET /api/v1/children/:childId/activities
GET /api/v1/children/:childId/goals
GET /api/v1/children/:childId/jobs
GET /api/v1/children/:childId/money
GET /api/v1/children/:childId/moments
GET /api/v1/children/:childId/graduated
GET /api/v1/children/:childId/insights
GET /api/v1/family/shared-goals
GET /api/v1/reviews/current
GET /api/v1/parent/conflicts
```

## 4.18 Child Today DTO

```ts
type ChildTodayDto = {
  date: IsoDate
  timezone: IanaTimezone
  sections: Array<{
    key: string
    title: string
    items: ActivityCardDto[]
  }>
  pendingJobs: number
  semanticEffectsSince?: string
  generatedAt: IsoInstant
}
```

Each `ActivityCardDto` contains only the fields needed to render and create valid commands, including the current resource version.

## 4.19 Parent Home DTO

```ts
type ParentHomeDto = {
  attentionItems: AttentionItemDto[]
  childSummaries: ChildSummaryDto[]
  pendingJobApprovals: number
  pendingSuggestions: number
  currentReview?: WeeklyReviewSummaryDto
  familyWorld: FamilyWorldSummaryDto
  generatedAt: IsoInstant
}
```

The parent home screen answers "what needs my attention?" rather than loading every analytics table.

## 4.20 Offline batch endpoint

```http
POST /api/v1/sync/commands
```

Request:

```json
{
  "deviceId": "019a...",
  "commands": [
    { "...": "command one" },
    { "...": "command two" }
  ]
}
```

Initial maximum batch size: 50 commands.

Each command is processed in its own server transaction so one conflict does not reject unrelated valid commands.

## 4.21 Batch result

```json
{
  "results": [
    {
      "commandId": "A",
      "status": "ACCEPTED"
    },
    {
      "commandId": "B",
      "status": "CONFLICT",
      "error": {
        "code": "STALE_VERSION"
      }
    },
    {
      "commandId": "C",
      "status": "DEPENDENCY_BLOCKED"
    }
  ],
  "serverTime": "..."
}
```

If C depends on B's aggregate/version, it is blocked rather than applied blindly. Unrelated D/E commands may continue.

## 4.22 Request hash and idempotency

Canonicalize the meaningful command envelope and calculate SHA-256. Do not include request headers or other transport metadata.

A duplicate accepted command is a success from the offline client's perspective.

## 4.23 Dexie local database

Use one database such as `LifeOSLocal`.

```text
snapshots
commandOutbox
conflicts
syncState
actorState
preferences
deviceState
```

Optional later table:

```text
drafts
```

for long weekly-review/goal text.

## 4.24 Snapshot record

```ts
type SnapshotRecord<T = unknown> = {
  id: string
  actorKey: string
  resourceKey: string
  data: T
  serverUpdatedAt?: IsoInstant
  cachedAt: IsoInstant
  schemaVersion: number
  privacy: 'CHILD_SAFE' | 'FAMILY_SHARED' | 'GUARDIAN_PRIVATE'
}
```

Do not blindly persist every TanStack Query cache entry.

## 4.25 Offline command record

```ts
type OfflineCommandRecord = {
  commandId: string
  actorKey: string
  familyId: string
  deviceId: string
  clientSequence: number
  schemaVersion: number
  type: string
  occurredAt: IsoInstant
  createdAt: IsoInstant
  expectedVersions: ExpectedVersion[]
  payload: unknown
  status: 'PENDING' | 'SYNCING' | 'BLOCKED' | 'CONFLICT' | 'FAILED'
  retryCount: number
  lastAttemptAt?: IsoInstant
}
```

Client `familyId` is local organization data; the server never trusts it as actor identity.

## 4.26 Local sequence allocation

Maintain `nextClientSequence` per actor/device in `syncState`. Increment and command insert must occur in one Dexie transaction.

Do not derive sequence from `MAX(existing)+1` without a transaction because multiple tabs/actions can race.

## 4.27 `executeCommand()` client facade

All feature UI sends commands through one application function:

```ts
executeCommand({
  type: 'CompleteActivity',
  payload: { activityInstanceId },
  optimisticStrategy: 'COMPLETE_ACTIVITY',
})
```

The facade:

```text
generates UUIDv7 commandId
captures occurredAt
captures resource versions
allocates client sequence
persists command in Dexie
applies permitted optimistic projection
signals SyncCoordinator
returns local accepted-intent result
```

React components never call `/api/v1/commands` directly.

## 4.28 Optimistic strategy matrix

| Action | Optimistic behavior |
|---|---|
| Complete ordinary activity | Mark visually complete + pending-sync indicator |
| Undo very recent unsynced completion | Reverse local optimistic state, update/cancel pending command if safe |
| Create/edit simple goal | Show provisional goal |
| Add goal progress | Show provisional progress with pending state |
| Submit job | Show Submitted/Pending Sync |
| Allocate money | Preview pending allocation; authoritative balances wait for server |
| Approve job | Guardian UI may show processing, but do not locally credit money |
| XP grant | Server-only result |
| Money credit | Server-only authoritative result |
| Autonomy change | Server-only result after approved command |
| Graduation | Server-only result after approved command |
| Financial correction | Server-only result |

## 4.29 SyncCoordinator interface

```ts
interface SyncCoordinator {
  start(): void
  stop(): void
  requestSync(reason: SyncTrigger): void
  retryConflict(conflictId: string): Promise<void>
  getStatus(): SyncStatus
}
```

Triggers:

```text
app startup
online event
foreground/visibility return
new command created while apparently online
manual retry
periodic retry while app is open
optional Background Sync signal
```

Do not depend solely on Background Sync.

## 4.30 Sync algorithm

```text
if another sync owns the client lock -> return

resolve active actor/session
if not authenticated -> retain commands and stop

load pending commands ordered by clientSequence
batch up to 50
POST /api/v1/sync/commands

for each result:
  ACCEPTED / ALREADY_APPLIED
    -> delete durable command
  CONFLICT
    -> create conflict record
    -> mark command CONFLICT
    -> block dependent same-aggregate commands
  DEPENDENCY_BLOCKED
    -> mark BLOCKED
  temporary network/server error
    -> keep PENDING
  AUTH_REQUIRED
    -> stop, retain all data

refetch affected canonical read models
persist selected fresh snapshots
repeat if safe pending commands remain
```

## 4.31 Cross-tab synchronization lock

Use the Web Locks API where available to reduce duplicate client sync work. The server's command idempotency remains the real correctness guarantee.

If Web Locks are unavailable, use a short-lived local coordination record/broadcast channel fallback; duplicates are still safe server-side.

## 4.32 Conflict types and handlers

Create typed conflict handlers:

```text
StaleConfigurationConflict
ActivityChangedWhileOfflineConflict
GoalChangedConflict
JobTermsChangedConflict
MoneyReviewConflict
AuthorizationChangedConflict
```

Each maps to a domain-aware UX, not a generic "sync failed" modal.

### Example: stale guardian edit

Show:

```text
You opened:
Reading - 20 minutes

Current version:
Reading - 30 minutes

[Keep latest]
[Reapply my changes]
```

### Example: archived activity while child offline

Show:

```text
This mission changed while your device was offline.
You do not need to do it anymore.
```

Do not expose HTTP 409 terminology to children.

## 4.33 Query keys

Every child/private query key is actor scoped.

```ts
['child', childId, 'today', date]
['child', childId, 'journey']
['child', childId, 'money']
['parent', familyId, 'home']
['parent', childId, 'insights', period]
['family', familyId, 'world']
```

Never use unscoped keys such as `['money']`.

## 4.34 Query hook abstraction

Create domain hooks:

```text
useChildToday()
useChildJourney()
useChildMoney()
useParentHome()
useChildInsights()
useFamilyWorld()
```

Each hook owns:

```text
query key
HTTP endpoint
freshness policy
offline persistence policy
snapshot resource key
privacy classification
```

Components do not independently combine Fetch + TanStack + Dexie.

## 4.35 Read persistence policy

Each query declares:

```ts
type OfflineReadPolicy = {
  persist: boolean
  ttl?: number
  privacy: 'CHILD_SAFE' | 'FAMILY_SHARED' | 'GUARDIAN_PRIVATE'
}
```

Examples:

```text
Child Today        persist true, CHILD_SAFE
Family World       persist true, FAMILY_SHARED
Parent audit log   persist false on shared devices, GUARDIAN_PRIVATE
```

## 4.36 Profile switching

Switching Eyad -> Malika:

```text
cancel actor-specific in-flight queries
change ActorContext
isolate/remove Eyad in-memory private query data
load Malika snapshots
start Malika Query namespace
retain explicitly family-shared read models
```

The server always re-authorizes the new child's requests.

## 4.37 Service worker contract

Service worker owns:

```text
static/application-shell caching
offline navigation fallback
push events
notification click handling
optional background-sync trigger
```

It does not calculate domain effects or own the command outbox.

Caching policies:

| Resource | Strategy |
|---|---|
| Versioned JS/CSS chunks | Cache First |
| Theme/icon assets | Cache First |
| App navigation shell | Network First + offline fallback |
| Manifest | Stale While Revalidate |
| Domain API GET data | Use TanStack/Dexie; do not depend on Cache Storage |
| Command POSTs | Never cache |

## 4.38 PWA update safety

When a new service worker is available, never force-reload a child/guardian in the middle of an important form.

Pending commands live in Dexie and survive static asset updates.

Commands carry `schemaVersion`. The server must support the immediately previous command schema during rolling client upgrades when practical.

## 4.39 Guardian auth adapter

Hide Supabase SSR package details behind:

```ts
interface GuardianAuthGateway {
  getCurrentGuardian(): Promise<GuardianIdentity | null>
  beginSignIn(input: SignInInput): Promise<void>
  signOut(): Promise<void>
  refreshSession(): Promise<void>
}
```

This isolates the application from auth-helper API changes.

## 4.40 Child-session endpoint

```http
POST /api/v1/auth/child-session
```

Request:

```json
{
  "childId": "019a...",
  "deviceId": "019a...",
  "pin": "1234"
}
```

Server flow:

```text
validate trusted device/family
rate-limit device + child + network
load Argon2id PIN hash
verify PIN in constant-time library path
apply cooldown on repeated failures
create 256-bit random opaque token
store token hash
set Secure HttpOnly cookie
return actor summary and expiry
```

## 4.41 Parent unlock

Parent mode on a shared child device uses short-lived re-authentication/unlock state. Parent unlock changes active actor capability; it never converts the child identity into a guardian.

The exact timeout is configuration, not embedded across screens.

## 4.42 Visual-world client contract

Server read model returns semantic world state:

```ts
type WorldStateDto = {
  stage: number
  unlocks: Array<{
    semanticKey: string
    unlockedAt: IsoInstant
  }>
  recentImpacts: SemanticImpactDto[]
}
```

Client theme manifest maps semantic keys to assets/stages/animations.

Initial implementation:

```text
SVG island
CSS/Web Animations API
curated deterministic story templates
static/lightly animated avatar
```

Rive/dotLottie are future enhancements, not MVP dependencies.

## 4.43 Story composer

Implement deterministic templates:

```ts
type StoryBeat =
  | 'NEW_BEGINNING'
  | 'PROGRESS'
  | 'MILESTONE'
  | 'RECOVERY'
  | 'GRADUATION'
  | 'FAMILY_CONTRIBUTION'
  | 'KINDNESS_MOMENT'
  | 'GOAL_ACHIEVED'
```

Input includes `StoryBeat` + effective ExperienceProfile. Output is translation keys and semantic visual cue. V1 does not use generative AI for child stories.

## 4.44 i18n implementation

Create Arabic and English message namespaces from the start.

```text
src/i18n/en/common.json
src/i18n/en/activities.json
src/i18n/en/story.json
src/i18n/ar/common.json
src/i18n/ar/activities.json
src/i18n/ar/story.json
```

Set `lang` and `dir` at the root. Prefer CSS logical properties such as `margin-inline-start` and `padding-inline-end`. Use bidirectional isolation (`bdi`/equivalent) for embedded technical identifiers or English text inside Arabic UI where necessary.

## 4.45 V2.2 mandatory API/offline tests

The implementation is incomplete until automated tests cover:

```text
child cannot read sibling private resource
child cannot approve own job/autonomy/graduation
guardian stale edit returns STALE_VERSION
duplicate command produces one domain effect
duplicate command with altered payload rejected
offline completion survives reload
offline completion preserves occurredAt
three-day offline replay preserves order
expired auth retains local commands
reauthentication resumes sync
one conflict does not reject unrelated batch commands
activity archived while offline resolves safely
job terms version mismatch requires child re-acceptance
money optimistic UI never creates authoritative balance
profile switch never reuses sibling query data
service worker never caches mutation POST responses
```

# 5. V2.3 - Delivery, Operations & Coding-Agent Specification

## 5.1 Delivery principles

The repository should always be in a state where the completed slices work end-to-end. Do not merge half a domain that cannot be exercised through tests/read models unless it is explicitly behind an implementation branch/feature flag.

The coding strategy is:

```text
small vertical slice
-> domain test
-> persistence test
-> API contract
-> client integration
-> offline behavior
-> E2E happy path
-> merge
```

## 5.2 Epic map

| Epic | Deliverable | Depends on |
|---|---|---|
| E0 | Engineering foundation | none |
| E1 | Family identity + child-scoped sessions | E0 |
| E2 | First responsibility vertical slice | E1 |
| E3 | Durable offline completion/sync | E2 |
| E4 | Reminders + independence + recovery | E3 |
| E5 | Graduation + regression monitoring | E4 |
| E6 | Growth + skill XP | E4 |
| E7 | Goals + shared goals | E1, E3 |
| E8 | Jobs + double-entry wallet | E1, E3 |
| E9 | Moments + Story | E1 |
| E10 | Visual World | E4, E6, E7, E9 |
| E11 | Weekly Review | E4, E7, E9 |
| E12 | Push notifications + scheduler hardening | E3, E4, E8 |
| E13 | Pilot hardening | all pilot features |

## 5.3 E0 - Engineering foundation

Stories:

```text
E0-S1 Bootstrap Next.js/TypeScript/pnpm
E0-S2 Configure strict TypeScript, lint, formatting, Vitest, Playwright
E0-S3 Create environment validation
E0-S4 Configure Supabase dev/local and private life_os schema
E0-S5 Configure Drizzle + node-postgres
E0-S6 Add request IDs, structured logging, error contract
E0-S7 Add Arabic/English shell and RTL/LTR primitives
E0-S8 Add PWA manifest/service-worker skeleton
E0-S9 Add CI quality gates and Vercel preview
```

Acceptance:

```text
production build succeeds
CI blocks type/test failures
preview deploy works
DB connectivity smoke passes
Arabic and English shells render correct direction
no private database access exists in browser bundle
```

## 5.4 E1 - Family identity and child-scoped sessions

Stories:

```text
Guardian sign-in adapter
Create family
Create child profile
Age-profile derivation
Experience preferences
Trusted household device enrollment
Set/reset child PIN
Create/revoke child session
Parent unlock on shared device
Parent/child route shells
Profile switcher
```

Acceptance:

```text
guardian can create family/child
child can enter with PIN on trusted device
child cannot access parent route/API
one child cannot access sibling private data
parent unlock expires according to config
revoked device cannot create new child session
```

## 5.5 E2 - First responsibility slice

Build `SELF_MAKE_BED` only before generalizing the template catalog.

Stories:

```text
seed Make Bed template
parent assigns to child
scheduler materializes today's instance
child Today read model renders it
CompleteActivity works online
parent can see completion history
policy resolves no money and training XP default
```

Acceptance:

```text
one instance per occurrence
duplicate tap cannot double complete
completion captures occurredAt/recordedAt
normal family/self responsibility cannot produce money
parent history reflects canonical completion
```

## 5.6 E3 - Offline foundation

Stories:

```text
Dexie schema v1
executeCommand facade
command outbox
SyncCoordinator
batch endpoint
idempotency
safe optimistic completion
offline app reload
conflict store
```

Acceptance:

```text
complete Make Bed with network disabled
close/reopen app
completion still visible pending sync
reconnect
server applies once
pending marker clears
replaying same command causes no duplicate progress
```

This epic must occur early; offline is not postponed until the end.

## 5.7 E4 - Reminder, independence, coverage, recovery

Stories:

```text
reminder scheduling records
external/system/child reminder source
self-initiation classification
consistency query
independence query
reminder dependency query
data coverage calculation
recovery opportunity calculation
parent insight card
child recovery recognition
```

Acceptance:

```text
unreported is not Missed
only confirmed miss opens recovery opportunity
recovery latency counts opportunities, not days
excused instances do not reduce consistency
low data coverage prevents readiness suggestion
recovery creates recognition but no XP bonus
```

## 5.8 E5 - Graduation and regression

Stories:

```text
evidence snapshot generation
graduation suggestion
guardian approval/decline/snooze
graduation celebration
remove from active gamified journey
I Manage These Myself read model
graduated monitoring schedule
parent observation
reactivation suggestion
```

Acceptance:

```text
system cannot graduate automatically
graduated responsibility remains parent-visible
no daily completion required after graduation
one negative observation does not automatically reactivate
approved reactivation restores appropriate guided state
```

## 5.9 E6 - Growth and XP

Stories:

```text
Growth activity policy
skill key
XP ledger
skill progress projection
milestone thresholds
Reading sample
Chess sample
XP correction
```

Acceptance:

```text
skill XP can only come from eligible growth/training policy
negative punishment XP impossible
corrected erroneous grant is auditable
XP cannot become money
same activity cannot be farmed through duplicate command replay
```

## 5.10 E7 - Goals and shared goals

Stories:

```text
create child goal
autonomy-aware approval
progress entry
revise target
pause/resume
target date reached flow
achieve/close/reflection
family SharedGoal
family contribution steps
```

Acceptance:

```text
Closed replaces Failed
revision preserves prior target
shared goal never exposes sibling leaderboard contribution ranking
deadline expiry does not auto-fail goal
age alone does not increase goal autonomy
```

## 5.11 E8 - Jobs and money

Stories:

```text
create/offer job
accept terms
submit/revision/approve
job revisions/terms version
money accounts
balanced ledger posting service
income credit
Give/Save/Spend allocation
spend/give entry
saving goals
financial correction
wallet read models
```

Acceptance:

```text
job payment fixed for accepted terms unless child accepts revision
unapproved job cannot credit ledger
all financial transactions balance to zero
no update/delete of existing ledger history through application role
Give is first, Save second, Spend third in UI
allocation total equals received/unallocated amount
closing saving goal leaves savings owned and saved
```

## 5.12 E9 - Moments and Story

Stories:

```text
record/update/archive Moment
value tags
child story timeline
curated story composer
age/experience variants
family Moment presentation
```

Acceptance:

```text
Moment produces no XP/money
no morality score exists
archived/corrected Moment remains auditable
story text is deterministic/translated for V1
```

## 5.13 E10 - Visual World

Stories:

```text
world unlock projection
personal/family world read models
SVG island base
semantic theme manifest
Home / Path / Bridge / Family Tree / Garden / Library / Harbor / Observatory regions
Immersive/Balanced/Focused renderers
Full/Reduced/Off motion
recent semantic-effect animation grouping
```

Acceptance:

```text
world renders from semantic unlocks
changing visualization level does not change domain state
changing theme requires no domain migration
reduced-motion removes nonessential motion without losing meaning
offline bulk sync does not play dozens of queued animations individually
```

## 5.14 E11 - Weekly Review

Stories:

```text
weekly review scheduling
child reflection entry
parent context summary
next-focus selection
skip/abandon behavior
Explorer/Builder/teen presentation variants
```

Acceptance:

```text
skipping review creates no penalty
review text is not personality-scored
children only edit their own reflection data
weekly summary uses facts, not moral judgment
```

## 5.15 E12 - Notifications and scheduler hardening

Stories:

```text
Web Push subscription
notification preferences
reminder intents
system tick
outbox worker
retry/backoff
notification deep links
monitoring prompts
suggestion daily evaluation
```

Acceptance:

```text
notification failure never changes domain state
failed push is not counted as ignored reminder
scheduler double-fire cannot duplicate instances
outbox double-worker cannot duplicate side effects
notifications follow quiet-hours/preferences
```

## 5.16 E13 - Pilot hardening

Checklist:

```text
backup/export script
restore rehearsal
shared-device security review
PIN brute-force/rate-limit tests
CSP/security headers
accessibility audit
Arabic RTL/LTR audit
offline chaos tests
iOS/Android PWA install tests
push tests where supported
performance smoke
migration rollback/forward recovery rehearsal
data export
privacy/minimization review
```

## 5.17 Environment model

Use:

```text
Local
Development cloud
Production
```

Optional preview deployments connect to a controlled dev/test database, not production.

Do not create arbitrary database schemas per Vercel preview until needed; data isolation and migration complexity outweigh the benefit for the family pilot.

## 5.18 Environment variables

Use validated server-only vs public separation.

Server-only examples:

```text
DATABASE_URL_RUNTIME
DATABASE_URL_MIGRATION
SUPABASE_SERVICE_ROLE_KEY              -- only if actually required; keep server-only
CHILD_SESSION_HASH_SECRET              -- if HMAC-based token hashing used
INTERNAL_SCHEDULER_SECRET
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Public/safe examples:

```text
NEXT_PUBLIC_APP_ORIGIN
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

The database credentials, scheduler secret, service-role credentials, raw child-session tokens, PINs, and private VAPID key must never appear in browser bundles/logs.

Use a Zod environment schema that fails startup/build for missing required values.

## 5.19 Feature flags

Do not add a commercial flag platform for MVP. Use typed server configuration for incomplete/experimental modules.

Suggested flags:

```text
visualWorldEnabled
pushEnabled
weeklyReviewEnabled
advancedMoneyEnabled
```

Flags do not bypass domain invariants. They only control feature availability/presentation.

## 5.20 CI pipeline

Pull request:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:domain
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e:smoke (for critical branches or when affected)
```

Main/prod:

```text
all PR gates
migration validation
migration apply in controlled step
production deployment
post-deploy health smoke
```

Never automatically apply destructive migrations from an unreviewed coding-agent PR.

## 5.21 Database migration release rule

Prefer expand-contract:

```text
1 add new nullable/parallel structure
2 deploy application supporting old + new
3 backfill/migrate data
4 switch reads/writes to new structure
5 verify
6 remove old structure in later release
```

For the small family pilot, some simple migrations can be atomic, but the repository should develop commercial-safe habits from the start.

## 5.22 Backup and restore

Family pilot baseline:

```text
scheduled encrypted logical export
export before risky migrations
retain multiple generations outside the primary database
periodic restore test into non-production environment
```

Before commercial launch, require provider-grade automated backups/PITR plus documented RPO/RTO.

A backup is not considered valid until restoration has been tested.

## 5.23 Observability

Structured server log fields:

```text
requestId
commandId nullable
actorKind
familyId hash/redacted identifier if appropriate
route/operation
result code
duration
```

Never log:

```text
child PIN
session cookie/raw token
full auth tokens
private VAPID key
sensitive Moment/reflection text by default
full money history unnecessarily
```

Operational counters should include:

```text
command error rate
sync conflicts
outbox backlog/failures
scheduler failures
auth/PIN throttling events
API latency
migration/deploy health
```

## 5.24 Security release policy

Framework/runtime security releases receive high priority. The selected Next.js release must remain on a patched active-LTS line. Node/runtime upgrades remain intentional and CI-tested.

Dependency scanners may create PRs, but automated merge should be limited to low-risk categories after tests; framework/security upgrades still receive human review.

## 5.25 Definition of Done

A Life OS feature is Done only if all applicable items are true:

```text
domain rule implemented
server authorization implemented
persistence/migration implemented
API command/query contract implemented
offline behavior explicitly defined
Arabic + English strings provided
RTL/LTR verified where relevant
accessibility semantics included
unit/domain tests pass
DB/application integration tests pass
offline tests pass when feature mutates offline
critical E2E exists
errors/conflicts have UX
relevant domain events/audit created
security/privacy classification reviewed
System Design invariants preserved
```

## 5.26 Agent-readable repository documentation

Commit:

```text
docs/system-design.md
docs/architecture.md
docs/implementation-spec.md
docs/domain-invariants.md
docs/commands.md
docs/api.md
docs/offline-sync.md
docs/visual-world.md
docs/adr/
```

`domain-invariants.md` should be concise and mandatory reading for every coding task.

## 5.27 Required ADRs

Start with:

```text
ADR-001 Modular monolith
ADR-002 PostgreSQL instead of Firestore
ADR-003 No direct browser domain-database access
ADR-004 Durable custom offline command outbox
ADR-005 Double-entry internal wallet ledger
ADR-006 Children use child-scoped sessions, not Supabase Auth users
ADR-007 Visual World stores semantic unlocks
ADR-008 No Redux for MVP
ADR-009 Domain mutations use HTTP command API, not Server Actions
ADR-010 Generative AI is not used for child story generation in V1
```

## 5.28 Coding-agent guardrails

Every coding-agent task must include these constraints:

```text
Do not invent business rules.
Do not bypass repositories/application handlers.
Do not access private domain tables from browser code.
Do not replace the command API with direct CRUD or Server Actions.
Do not create XP/money behavior unless the policy/spec explicitly allows it.
Do not create negative XP or punishment deductions.
Do not add a global child score or sibling leaderboard.
Do not silently resolve stale version conflicts.
Do not UPDATE/DELETE financial history.
Do not auto-approve autonomy or graduation.
Do not treat no data as failure.
Do not make app engagement itself a child-development target.
Do not persist sensitive guardian data on shared child devices
without an explicit privacy policy.
Do not make destructive migrations without explicit approval.
Always add/update tests for changed domain behavior.
Use existing vocabulary and state machines exactly.
When the specification is ambiguous, record the ambiguity
rather than choosing a new behavioral rule.
```

## 5.29 Coding-agent task template

Every implementation task should be framed like:

```text
TASK
Implement <single slice/story>.

AUTHORITATIVE REFERENCES
- docs/domain-invariants.md
- relevant System Design section
- relevant Architecture section
- relevant Implementation Specification section

SCOPE
- files/modules allowed to change
- command/query to implement
- database migration if needed
- UI/read model involved

OUT OF SCOPE
- adjacent features that must not be added

ACCEPTANCE CRITERIA
- Given/When/Then behavior

TESTS REQUIRED
- domain
- integration
- offline
- E2E if applicable

ARCHITECTURE CONSTRAINTS
- server canonical
- family scoping
- command idempotency
- no direct browser DB access
- etc.

DELIVERABLE
- code
- migrations
- tests
- updated docs/ADR only if a decision changed
```

This is preferable to asking an agent "build the goals feature" with no boundaries.

# 6. Master Implementation Prompt for Coding Agents

The following prompt can be used as the repository-level master instruction for a coding agent. Individual work items should still append a narrowly scoped task and acceptance criteria.

```text
You are implementing Life OS for Kids, an offline-capable family PWA.

AUTHORITATIVE ORDER OF PRECEDENCE
1. System Design V0.1-V0.4 - product/domain behavior.
2. System Architecture V1.0-V1.3 - technical boundaries.
3. Implementation Specification V2.0-V2.3 - implementation contract.
4. The current task's explicit acceptance criteria.

If two instructions conflict, do not silently choose.
State the conflict and preserve the higher-precedence specification
unless the task explicitly updates it.

CORE PRODUCT PURPOSE
Life OS helps children progressively become more independent.
The system should become less necessary as behavior becomes internalized.
It visualizes growth without turning every behavior into a reward economy.

NON-NEGOTIABLE DOMAIN INVARIANTS
- XP never converts to money.
- Money never buys XP or moral progress.
- Values do not generate XP or money.
- Faith does not generate XP or money by default.
- Normal self/family responsibilities do not generate money.
- Paid work is represented by Job.
- No negative/punishment XP.
- Corrections may reverse erroneous XP but are not punishment.
- Missed work never erases previously earned progress.
- Unknown/unreported is not automatically Missed.
- Excused opportunities do not reduce consistency.
- Recovery is recognized but does not receive XP solely for recovery.
- No sibling leaderboard.
- No morality score/global child score.
- Age supplies defaults, not automatic autonomy.
- Autonomy and graduation require authorized guardian approval.
- Graduated responsibilities remain parent-visible for lightweight monitoring.
- Financial history is append-only and corrected through compensating entries.
- Visual theme/presentation never changes domain logic.
- Every important action has one primary semantic meaning.

ARCHITECTURE INVARIANTS
- Modular monolith.
- Pure TypeScript domain must not depend on React, Next.js, Drizzle,
  Supabase, Dexie, or Vercel.
- Browser never accesses the private life_os PostgreSQL schema directly.
- All domain mutations use the command API.
- All commands are idempotent through commandId + request hash.
- Mutable configuration uses optimistic versions; never silently last-write-wins stale edits.
- PostgreSQL is canonical; IndexedDB stores cached read models and durable pending intent.
- Dexie commandOutbox is the only durable offline mutation queue.
- TanStack Query is in-memory server-state cache, not durable domain mutation storage.
- Money uses integer minor units and an internal double-entry ledger.
- Domain events are append-only but the product is not full event sourcing.
- Asynchronous side effects use transactional outbox semantics.
- Query/read APIs return presentation-ready DTOs, not raw database rows.
- Query keys and local data are actor scoped.
- Sensitive guardian data should not be durably persisted on shared child devices by default.

SECURITY
- Treat browser input as untrusted.
- ActorContext is derived server-side from guardian/child/system credentials.
- Every tenant-owned repository operation is family scoped.
- Children may access only their own private data plus explicitly family-shared resources.
- Parent/guardian privileges are server-enforced; hiding UI is insufficient.
- Never log raw tokens, PINs, secrets, or sensitive child text unnecessarily.
- Use Zod validation at external boundaries.
- Do not expose stack traces/internal DB errors to clients.

OFFLINE
- Persist a command to IndexedDB before presenting it as safely accepted locally.
- Offline commands retain real occurredAt timestamps.
- Replaying the same command must not duplicate XP, money, progress, or events.
- Commands remain until accepted or explicitly resolved; do not age them out silently.
- Generic network failure is not behavioral failure.
- Conflicts use typed domain-specific UX.

FRONTEND
- Next.js App Router with a client-heavy installed PWA experience.
- Domain mutations remain HTTP Route Handler command contracts,
  not Server Actions, because they must be replayable offline.
- TanStack Query for server-state cache.
- Dexie for structured durable offline data.
- React Hook Form + Zod for forms.
- No Redux unless a later ADR explicitly introduces it.
- Arabic and English are supported from the start;
  use logical CSS properties and bidirectional isolation.
- Respect reduced-motion accessibility.

VISUAL WORLD
- Backend stores semantic impacts/unlocks, never theme-specific pixels or animations.
- V1 uses SVG + CSS/Web Animations and curated deterministic story templates.
- Moments/values are represented as stories/memories, never moral points.
- Recovery, graduation, family contribution, growth, and goals
  have distinct semantic visual meanings.

IMPLEMENTATION STYLE
- Prefer explicit, boring, testable code over clever abstraction.
- Keep Route Handlers thin.
- Keep domain rules centralized and unit tested.
- Do not introduce a new dependency unless the existing stack cannot
  reasonably solve the task; explain additions.
- Do not reorganize unrelated modules while implementing a scoped task.
- Use migrations for DB changes; do not edit production schema manually.
- Add tests before considering a domain behavior complete.

BEFORE CODING A TASK
1. Read the relevant design/architecture/implementation sections.
2. Identify affected domain invariant(s).
3. Identify actor permissions.
4. Identify offline behavior.
5. Identify persistence/migration impact.
6. Identify required tests.

AFTER CODING
Report:
- files changed;
- migrations added;
- domain rules implemented;
- tests added and their results;
- any unresolved ambiguity;
- any deviation from the specification (should normally be none).
```

# 7. First Repository Build Sequence

When actual implementation starts, use this order for the first working loop:

```text
1  Bootstrap Next.js / TypeScript / pnpm.
2  Add strict type/lint/test/build CI.
3  Configure Supabase local/dev and Drizzle runtime/migration URLs.
4  Create private life_os schema and family/guardian/child tables.
5  Implement guardian auth adapter.
6  Implement trusted household devices and child-scoped sessions.
7  Create parent/child route shells and ActorResolver.
8  Seed SELF_MAKE_BED.
9  Implement activity assignment persistence and parent setup UI.
10 Implement recurring-instance materializer.
11 Build GET child/today read model.
12 Render child Today screen.
13 Implement CompleteActivity command end-to-end.
14 Add domain and DB tests for completion/idempotency.
15 Add parent activity-history read model.
16 Add Dexie local DB and command outbox.
17 Make CompleteActivity work offline and survive reload.
18 Implement batch sync and conflict records.
19 Verify command replay applies exactly once.
20 Add reminder records/self-initiation classification.
21 Add independence, consistency, data coverage, and recovery calculations.
22 Add first semantic Visual World progression.
```

At step 22 the product has its first complete Life OS loop:

```text
real responsibility
    -> child action
    -> durable offline intent
    -> server domain interpretation
    -> independence/recovery progress
    -> visual impact
    -> parent insight
```

# 8. Pilot Gates

## 8.1 Pilot Gate A - Core responsibility loop

Required before the children use the app for real daily tracking:

```text
E0 Foundation
E1 Identity/sessions
E2 Responsibility slice
E3 Offline foundation
E4 Progress/recovery
backup/export available
offline/reload E2E passing
sibling isolation test passing
```

Primary hypothesis:

> Does visible progress plus reduced prompting help responsibility become more independent without paying for ordinary responsibilities?

## 8.2 Pilot Gate B - Broader Life OS

Add:

```text
E5 Graduation
E6 Growth XP
E7 Goals
E8 Jobs/Money
```

Questions:

```text
Do responsibilities graduate and remain stable?
Does recovery feel healthier than streak punishment?
Does XP motivate learning without contaminating family responsibilities?
Do Give/Save/Spend mechanics create better money conversations?
Does child autonomy gradually increase under parent-approved evidence?
```

## 8.3 Pilot Gate C - Meaning/story layer

Add:

```text
E9 Moments/Story
E10 Visual World
E11 Weekly Review
```

Questions:

```text
Do children remember and understand meaningful Moments without numerical moral scoring?
Does the Visual World communicate life growth rather than become a point-chasing game?
Does Weekly Review produce useful family conversation
without feeling like a performance review?
```

# 9. Implementation Risk Register

| Risk | Mitigation |
|---|---|
| Offline logic becomes a second domain engine | Client only predicts safe presentation; server calculates effects |
| Too many abstractions before product proof | Implement one vertical slice first, generalize only after use |
| Visual World consumes too much effort | Ship semantic SVG milestone system before Rive/game-like animation |
| Money bugs | Double-entry ledger + append-only + integration/property tests |
| Sibling/privacy leak from caches | Actor-scoped keys, snapshot privacy policy, shared-device cache tests |
| Parent/child session confusion | Single ActorResolver + child-scoped session + explicit parent unlock |
| AI coding agent rewrites architecture | ADRs + master instructions + narrow tasks + CI invariant tests |
| Thresholds become treated as scientific truth | Central config + explainable evidence + parent approval |
| Notifications create dependence | Reminder source analytics + controlled escalation + quiet hours |
| App engagement becomes product goal | Product metrics focus on independence/graduation, not opens/streaks |
| Arabic/English layout breaks late | i18n/RTL from E0; no left/right hard-coding |
| Database changes break offline commands | schemaVersion + backwards command support + expand-contract releases |

# 10. Definition of Implementation Freeze

The implementation specification is considered complete enough to begin coding when:

```text
System Design V0.1-V0.4 remains authoritative and unchanged.
System Architecture V1.0-V1.3 remains authoritative and unchanged.
V2.0-V2.3 are committed into the repository docs.
Core domain invariants have executable tests.
Command/API/error envelope contracts are defined.
Database migration order and ledgers are defined.
Offline command/snapshot/conflict schemas are defined.
Epics and pilot gates are defined.
Master agent instructions are available.
```

Implementation may expose genuine contradictions. If that happens, create an ADR/spec revision rather than silently diverging from the documents.

# 11. Reference sources

The implementation baseline was checked against current primary documentation on 3 October 2026:

- Node.js release information and LTS/current status: https://nodejs.org/en/blog/release
- Node.js release schedule evolution: https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule
- Next.js current releases/security updates: https://nextjs.org/blog
- Next.js App Router documentation: https://nextjs.org/docs/app
- Supabase server-side authentication: https://supabase.com/docs/guides/auth/server-side
- Supabase Next.js authentication/client setup: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- Drizzle PostgreSQL / node-postgres: https://orm.drizzle.team/docs/get-started-postgresql
- TanStack Query React v5: https://tanstack.com/query/latest/docs/framework/react
- Dexie / IndexedDB documentation: https://dexie.org/docs

# Appendix A - Domain invariants checklist
- [ ] XP can never become money.
- [ ] Money can never purchase XP.
- [ ] No negative XP as punishment.
- [ ] Erroneous XP may only be reversed through auditable correction.
- [ ] Values cannot produce XP.
- [ ] Values cannot produce money.
- [ ] Faith does not produce XP or money by default.
- [ ] Normal family responsibility does not produce money.
- [ ] Paid work is modeled as a Job.
- [ ] Every meaningful activity has one primary semantic meaning.
- [ ] No sibling leaderboard or direct sibling score comparison.
- [ ] No composite morality/child/life score.
- [ ] Unknown/unreported activity is not a miss.
- [ ] Excused/not-applicable/paused opportunities do not reduce consistency.
- [ ] Confirmed misses do not erase previously earned progress.
- [ ] Recovery is measured in valid opportunities.
- [ ] Recovery recognition alone does not grant XP.
- [ ] Age supplies defaults, never automatic autonomy promotion.
- [ ] Autonomy changes require authorized guardian decision.
- [ ] Graduation requires authorized guardian decision.
- [ ] Reactivation after regression requires authorized guardian decision.
- [ ] Graduated responsibilities remain visible for lightweight guardian monitoring.
- [ ] Financial ledger and postings are append-only.
- [ ] Historical domain events and audit records are append-only.
- [ ] Visual theme/visualization level never changes domain state.
- [ ] Every configurable selection has a sensible recommended default.
- [ ] Changing a future schedule never rewrites historical instances.
- [ ] App engagement is not a child-development success metric.
- [ ] Notification delivery is not behavioral truth.
- [ ] Offline intent is durable until accepted or explicitly resolved.

# Appendix B - Core read-model catalog
| Read model | Primary consumer | Offline persistence |
|---|---|---|
| Child Home | child | yes |
| Child Today | child | yes |
| Child Journey | child | yes |
| Child Goals | child | yes for active subset |
| Child Money Summary | child | yes, limited/recent |
| Child Story | child | recent subset |
| Family World | child/guardian | yes |
| Parent Home | guardian | guardian device only |
| Child Insights | guardian | limited/selective; avoid shared child device |
| Graduated Monitoring | guardian | guardian device only |
| Audit History | guardian/system | normally no local persistence |

# Appendix C - Core offline test cases
1. Complete an activity offline and reload before reconnecting.
2. Replay the same command after the network drops after server commit.
3. Remain offline for three days; verify `occurredAt` remains original.
4. Parent archives an activity while child is offline; child later syncs obsolete completion.
5. Parent and parent edit same assignment from stale versions.
6. App updates while old-schema commands are pending.
7. Auth expires with pending commands; reauthentication resumes without loss.
8. Two tabs attempt to sync same outbox.
9. One batch command conflicts while unrelated commands continue.
10. Profile switch never displays the previous child private cache.
11. Device goes offline during money allocation; no authoritative balance is faked.
12. Notification delivery failure does not alter reminder/behavior facts.

# Appendix D - Initial system data keys
Suggested stable keys:
```text
SELF_MAKE_BED
SELF_PREPARE_SCHOOL_BAG
SELF_MORNING_HYGIENE
FAMILY_HELP_DINNER
GROWTH_READING
GROWTH_CHESS_PRACTICE
GROWTH_MATH_PRACTICE

VISUAL_INDEPENDENCE_STAGE_1
VISUAL_INDEPENDENCE_STAGE_2
VISUAL_INDEPENDENCE_GRADUATED
VISUAL_FAMILY_GARDEN_STAGE_1
VISUAL_FAMILY_GARDEN_STAGE_2
VISUAL_READING_LIBRARY_STAGE_1
VISUAL_MONEY_HARBOR_STAGE_1

STORY_RECOVERY_EXPLORER
STORY_RECOVERY_BUILDER
STORY_GRADUATION_EXPLORER
STORY_GRADUATION_BUILDER
```

# Appendix E - First pilot operational checklist
- [ ] Production and dev environments are isolated.
- [ ] Production secrets are not present in client bundle.
- [ ] Guardian and child sessions can be revoked.
- [ ] Child PIN attempts are rate-limited and hashed securely.
- [ ] Cross-child resource access fails server-side.
- [ ] Offline completion survives reload and reconnects exactly once.
- [ ] Command conflicts are visible in parent Needs Review.
- [ ] Financial postings balance and history is append-only.
- [ ] Backup export has been created and a restore has been tested.
- [ ] Arabic and English core flows render correctly.
- [ ] Reduced-motion core flow works.
- [ ] PWA opens after first install while offline.
- [ ] No child behavior is sent to advertising/third-party behavioral analytics.
- [ ] Critical Playwright pilot suite is green.
- [ ] Parent knows how to resolve a sync conflict without losing child intent.

# Appendix F - Reference implementation sequence
The recommended first development iteration is intentionally narrow:
```text
1  Bootstrap Next.js + TypeScript + pnpm
2  Quality tooling and CI
3  Supabase local/dev and Drizzle private schema
4  Family / guardian / child profile persistence
5  Guardian authentication adapter
6  Trusted device + child session
7  Parent and child shells
8  Seed SELF_MAKE_BED template
9  Assignment creation
10 Materialize one activity instance
11 Child Today read model
12 Render Today
13 CompleteActivity command
14 Domain + DB tests
15 Parent activity history
16 Dexie command outbox
17 Complete offline and reload
18 Reconnect and sync
19 Verify command idempotency
20 Add reminder/self-initiation evidence
21 Add recovery/data coverage
22 Show first semantic visual progress
```

At step 22, the first complete Life OS loop exists: real responsibility -> durable child action -> domain interpretation -> visible progress -> parent insight.

# Appendix G - Reference baseline and verification
Technology facts in this specification were verified against official sources on 3 October 2026. Use the latest security-patched release within the approved line when implementation begins, then commit the resulting lockfile.

- Node.js release status: https://nodejs.org/en/about/previous-releases
- Next.js release/security announcements: https://nextjs.org/blog
- Next.js 16: https://nextjs.org/blog/next-16
- Supabase PostgreSQL connections/pooler: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase Postgres.js pooling warning: https://supabase.com/docs/guides/database/postgres-js
- Drizzle PostgreSQL/node-postgres: https://orm.drizzle.team/docs/get-started-postgresql
- TanStack Query React v5: https://tanstack.com/query/latest/docs/framework/react
- Dexie versioning/schema: https://dexie.org/docs/Tutorial/Design
- Dexie stores/indexes: https://dexie.org/docs/Version/Version.stores()

# Appendix H - Glossary
| Term | Meaning |
|---|---|
| ActorContext | Server-resolved identity and scope for Guardian, Child or System. |
| Aggregate | A consistency boundary updated through a domain command, often versioned for optimistic concurrency. |
| Command | An explicit request to change state. |
| Domain Event | Append-only record that a meaningful domain fact occurred. |
| Read Model | Purpose-built API/view representation for a screen or workflow. |
| Outbox | Transactional queue of asynchronous side effects created alongside domain state. |
| Child-scoped session | Opaque server-enforced session limited to one child, family, device and child permissions. |
| Data Coverage | How much of the expected observation period has known/resolved data. |
| Recovery Latency | Number of valid opportunities required to return after a confirmed miss. |
| Semantic Effect | Presentation-safe interpretation returned after a command; not authoritative domain history. |
| Semantic Unlock | Theme-independent visual milestone stored by meaning, not by specific asset. |
| Experience Profile | Effective presentation profile derived from age defaults plus selected preferences. |
| Canonical State | Server/PostgreSQL state accepted as current truth after domain validation. |
| Pending Intent | Durable offline command not yet accepted by the server. |
| Optimistic Projection | Temporary client presentation of a safe expected outcome while canonical validation is pending. |
| Shared Goal | A family-owned goal where progress belongs to the family rather than ranked individuals. |

# 12. Final implementation contract

**Implementation Specification V2.0-V2.3 is frozen for the MVP family pilot.** Changes to frozen decisions should be intentional and documented through an ADR or specification update.


The three permanent project specifications now have distinct responsibilities:

```text
SYSTEM DESIGN V0.1-V0.4
Why the system exists and what behavior it must produce.

SYSTEM ARCHITECTURE V1.0-V1.3
How technical responsibilities are separated and how the system is structured.

IMPLEMENTATION SPECIFICATION V2.0-V2.3
Exactly how engineering work is organized, persisted, exposed, synchronized,
tested, delivered, and delegated to coding agents.
```

Implementation begins only from these documents; coding does not become a new product-design process.