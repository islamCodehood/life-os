---
title: "Life OS for Kids - System Architecture"
subtitle: "Consolidated Architecture Specification V1.0-V1.3"
author: "Architecture working document"
date: "3 October 2026"
---

# Document purpose

This document consolidates System Architecture V1.0 through V1.3 for **Life OS for Kids**. It is the authoritative architecture companion to the System Design V0.1-V0.4 specification. The document deliberately separates behavioral/domain truth from technical implementation so that infrastructure, visual themes, and clients can evolve without changing the educational model.

The core architecture principle is:

> **PostgreSQL stores facts. The domain interprets facts. The frontend visualizes interpretations.**

The second principle is equally important:

> **The system is offline-capable, but the server remains canonical. A local action is durable intent waiting to be reconciled, not an alternative source of business truth.**

# Architecture status

| Version | Scope | Status |
|---|---|---|
| V1.0 | Platform, cloud, runtime boundaries, modular-monolith decision | Frozen for MVP |
| V1.1 | Database, API, sessions, commands/events, sync contract, scheduler | Frozen for MVP |
| V1.2 | Frontend/PWA, IndexedDB, outbox, service worker, visual-world client architecture | Frozen for MVP |
| V1.3 | Security, privacy, i18n, operations, release, backup/recovery, scaling | Frozen baseline; operational values are configurable defaults |

# 1. Executive architecture summary

The recommended MVP architecture is:

```text
Child / Parent Devices
        |
        | HTTPS
        v
Next.js 16 PWA on Vercel
        |
        +-- Server route handlers / BFF
        +-- Authentication + authorization
        +-- Application command/query layer
        +-- Pure TypeScript domain core
        |
        v
Supabase PostgreSQL
        |
        +-- private life_os schema
        +-- guardian auth in Supabase Auth
        +-- cron/scheduled jobs
        +-- storage when later required

On each device
        |
        +-- TanStack Query: in-memory server-state cache
        +-- Dexie / IndexedDB: durable snapshots + command outbox
        +-- Service Worker Cache Storage: static PWA resources
        +-- Web Push: reminders/notifications
```

## 1.1 Chosen stack

| Layer | Choice |
|---|---|
| Web/PWA | Next.js 16 App Router + React + TypeScript |
| UI | Tailwind/CSS + Life OS component system |
| Server-state client | TanStack Query |
| Durable offline data | IndexedDB through Dexie |
| Forms | React Hook Form |
| Validation/contracts | Zod |
| Backend/API | Next.js Route Handlers, Node.js runtime |
| Domain | Pure TypeScript modular monolith |
| Database | PostgreSQL via Supabase |
| ORM | Drizzle ORM + `node-postgres` |
| Guardian authentication | Supabase Auth |
| Child authentication | Device-bound, child-scoped sessions |
| Scheduler | Supabase Cron / `pg_cron` invoking signed internal endpoint |
| Push | Standard Web Push + VAPID |
| Hosting | Vercel |
| Tests | Vitest + PostgreSQL integration tests + Playwright |
| CI/CD | GitHub + Vercel + versioned SQL/Drizzle migrations |

## 1.2 Deliberately not selected

For the MVP we do **not** use microservices, full event sourcing, GraphQL, Firebase/Firestore as the canonical database, Redux as the primary application state, a game engine, third-party behavioral analytics, real payment rails, or direct browser writes to Supabase domain tables.

# 2. V1.0 - Platform and runtime architecture

## 2.1 Architecture goals

The system must support:

- offline-first daily use;
- strict family and sibling isolation;
- parent and child modes on shared devices;
- immutable/auditable financial history;
- stale-edit detection instead of blind last-write-wins;
- idempotent offline command replay;
- recurring activities and scheduled suggestions;
- push reminders that are side effects, not truth;
- semantic visual progress independent from visual theme;
- a mostly-free family pilot with a credible commercial scaling path.

## 2.2 Modular monolith

The application is one deployable backend with strong internal module boundaries:

```text
Life OS
  Identity & Family
  Activities
  Progress
  Goals
  Work & Money
  Values & Moments
  Autonomy & Graduation
  Reviews
  Visual World
  Notifications
  Analytics
```

These are bounded code modules, not separate services. The modular monolith avoids distributed-system overhead while keeping clean extraction boundaries if scale later requires it.

## 2.3 Domain dependency rule

```text
Presentation
    |
Application commands / queries
    |
Domain rules / policies
    |
Repository interfaces
    |
Infrastructure implementations
    |
PostgreSQL / Push / Auth / Clock
```

The domain layer must not import React, Next.js, Supabase, Drizzle, Vercel, IndexedDB, or Web Push SDKs.

## 2.4 Why Next.js instead of a pure Vite SPA

A Vite/React client could render the product, but Life OS benefits from a same-origin backend-for-frontend because parent/child identity, HTTP-only cookies, child-scoped sessions, authorization, command replay, and conflict resolution are central concerns. Next.js provides UI and API deployment in one application while still allowing the interactive product surface to behave like a client-heavy SPA.

## 2.5 Why PostgreSQL / Supabase instead of Firestore

The domain is relational and audit-heavy. PostgreSQL naturally supports foreign keys, transactions, unique occurrence constraints, immutable ledgers, optimistic concurrency, and complex analytical queries. Firestore's offline convenience is attractive, but automatic last-write-wins behavior is incompatible with the explicit stale-edit review designed for guardian configuration and financial correctness.

## 2.6 Server remains canonical

```text
LOCAL
  cached read models
  optimistic presentation
  pending commands

SERVER
  canonical current state
  domain rules
  money / XP ledgers
  authorization
  domain events
```

Offline does not mean that the server ignores real-world occurrence time. Commands preserve `occurredAt`; the domain evaluates them against the state that was effective when the real action happened.

# 3. Authentication and authorization architecture

## 3.1 Guardian identity

Guardians use Supabase Auth. Initial supported modes can be email OTP/magic link or password-based authentication. Guardian identity in `auth.users` is mapped to Life OS family membership in the private application schema.

## 3.2 Children are profiles, not identity-provider accounts

Children do not need their own email, phone number, Google identity, or Supabase Auth user. A child is a domain profile under a family.

```text
Supabase Auth User
       |
Guardian Profile
       |
Family Membership
       |
Child Profiles
```

This minimizes unnecessary child identity collection.

## 3.3 Child-scoped session

A child-scoped session is a server-enforced temporary identity for one child on one trusted household device.

```text
Current actor: CHILD
Family: family-123
Child: eyad-456
Device: tablet-789
Permissions:
  own activities
  own goals
  own allowed money actions
  own journey/story
  shared family content
Denied:
  sibling private data
  parent analytics
  job approval
  wallet correction
  autonomy/graduation approval
```

The browser receives an opaque secure HTTP-only cookie. The database stores only a hash of the child-session token.

## 3.4 Shared-device parent unlock

A guardian may remain authenticated on a household tablet while the active UI actor is a child. Entering parent mode requires a short-lived parent unlock/re-authentication step. Merely switching the visible profile cannot grant guardian permissions.

## 3.5 Authorization inputs

Authorization decisions combine:

```text
Actor role
+ family membership
+ resource ownership/scope
+ current autonomy state when relevant
+ requested action
```

The browser is always untrusted. Hiding buttons is UX, not authorization.

# 4. V1.1 - Database architecture

## 4.1 Private application schema

Use two broad PostgreSQL schemas:

```text
auth
  Supabase-managed identity tables

life_os
  private application domain tables
```

`life_os` is not exposed to the browser Data API. The Next.js backend is the only application access path.

## 4.2 Runtime database connection

```text
Vercel Node runtime
      |
Drizzle ORM
      |
node-postgres (pg)
      |
Supabase transaction pooler
      |
PostgreSQL
```

Runtime and migrations use separate database connection strings. Schema migration tooling uses a direct/session-capable connection, while serverless runtime requests use transaction pooling.

## 4.3 Dedicated database role

Production uses a dedicated `life_os_api` database role with only the privileges required by the application. It is not the PostgreSQL superuser.

## 4.4 Tenant integrity

All family-owned records carry `family_id`. Repositories require tenant scope explicitly:

```text
findActivity({ familyId, activityId })
```

not:

```text
findActivity(activityId)
```

Composite foreign keys are used where useful so PostgreSQL itself rejects cross-family relationships.

## 4.5 Identifier policy

Application IDs use UUIDv7 generated in TypeScript. This permits client-side ID creation during offline work and avoids remapping temporary IDs after synchronization.

## 4.6 Time semantics

Three different time concepts are preserved:

| Field | Meaning |
|---|---|
| `occurred_at` | Real-world event time |
| `recorded_at` | When Life OS learned about the event |
| `effective_from` | When a configuration becomes valid |

All stored timestamps are UTC. Recurrence interpretation uses an IANA timezone such as `Africa/Cairo`.

## 4.7 Money representation

Money amounts use integer minor units (`BIGINT amount_minor`), never binary floating point. Currency uses ISO-style three-letter codes such as `EGP`.

# 5. Core database groups

The following is the logical persistence map. It is intentionally not a one-to-one copy of UML classes.

```text
identity
  families
  guardian_profiles
  family_guardians
  child_profiles
  experience_preferences
  household_devices
  child_pin_credentials
  child_sessions

activities
  activity_templates
  activity_definitions
  activity_assignments
  activity_instances
  completion_records
  reminder_records
  activity_corrections
  pause_windows

progress
  metric_snapshots
  xp_ledger
  skill_progress
  milestones
  milestone_rewards

goals
  goals
  goal_progress_entries
  goal_revisions

work_and_money
  jobs
  job_revisions
  money_accounts
  money_transactions
  money_postings
  saving_goals

values
  moments
  moment_tags

autonomy
  autonomy_domains
  evidence_snapshots
  suggestions
  graduation_records
  parent_observations

reviews
  weekly_reviews
  weekly_review_entries

visual_world
  world_unlocks

system
  processed_commands
  domain_events
  outbox_messages
  audit_log
  scheduler_runs
```

# 6. Activity persistence

## 6.1 Activity templates

Templates provide onboarding defaults: title, why, category, age range, default schedule, and default policy. Templates are editable starting points; hard domain invariants are enforced separately.

## 6.2 Activity assignments

Assignments connect a child to a definition and contain schedule, tracking mode, completion/approval modes, progress mode, XP mode, reminder policy, and effective dates.

RFC-style recurrence rules are preferred for persisted recurrence because they can represent daily, weekdays, weekly, and more complex schedules without creating a proprietary scheduling grammar.

## 6.3 Opportunity windows

Each generated activity instance has:

```text
available_from
    target_at
opportunity_ends_at
```

This permits on-time, late-but-valid, unresolved, excused, and missed semantics without relying on calendar dates alone.

## 6.4 Activity instance states

```text
PENDING
COMPLETED
AWAITING_RESOLUTION
MISSED
EXCUSED
NOT_APPLICABLE
```

No record at the end of the opportunity becomes `AWAITING_RESOLUTION`, not automatically `MISSED`.

# 7. Progress and XP persistence

Behavioral metrics are derived from facts, not stored as identity labels. `metric_snapshots` may cache calculated rates such as independence, consistency, recovery, reminder dependency, and data coverage. These snapshots are disposable projections that can be rebuilt.

XP is append-oriented in `xp_ledger`. A correction can reverse an erroneous grant, but there is no punishment entry type. `skill_progress` is a projection/cache over the ledger.

# 8. Goals, jobs, and agreements

Goals preserve target revisions rather than rewriting history. Shared goals are family-owned goals, not competitive sibling objects.

Jobs have explicit state and terms versioning. A child accepts a specific `terms_version`. If the parent changes payment or scope afterward, the system knows that the revised terms have not been accepted. This enforces the product's fairness rule around agreements.

# 9. Money architecture - internal double-entry ledger

The wallet is modeled as an internal double-entry ledger rather than a mutable balance field.

Child-owned accounts initially include:

```text
UNALLOCATED
GIVE
SAVE
SPEND
```

A counterparty/system account balances income and outflow transactions.

Example - earn 100 EGP:

```text
UNALLOCATED   +100
EXTERNAL      -100
-----------------
TOTAL            0
```

Example - allocate the 100 EGP:

```text
UNALLOCATED   -100
GIVE           +10
SAVE           +40
SPEND          +50
-----------------
TOTAL             0
```

Balances are queries over postings. Historical money transactions and postings are append-only to the normal application role. Corrections are new transactions, never UPDATE/DELETE of the original financial history.

# 10. Autonomy, suggestions, and graduation persistence

Autonomy is stored per domain/capability, not as one child score. `evidence_snapshots` capture the exact observations used to create an explainable suggestion. `suggestions` record proposed transitions and guardian decisions. Suggestions never silently mutate autonomy.

Graduated responsibilities move into monitoring records. Parent observations are append-oriented facts used to support stable/needs-help/reactivation decisions.

# 11. Commands, events, and audit history

## 11.1 Command mutation API

All meaningful mutations use a stable command endpoint:

```text
POST /api/v1/commands
```

A command includes a client-generated `commandId`, type, occurrence time, expected aggregate versions where relevant, and payload. The client does **not** send trusted family identity, XP amount, money reward, semantic meaning, or readiness decisions.

## 11.2 Idempotency

`processed_commands.command_id` is unique. Replaying the same command ID with the same request hash returns the already-applied result. Reusing the same ID with a different payload returns an idempotency-key error.

## 11.3 Optimistic concurrency

Mutable aggregate roots have a monotonically incremented `version`. Stale edits produce an explicit `409 STALE_VERSION` instead of silently overwriting another guardian's change.

## 11.4 Domain events

Important facts are appended to `domain_events` for auditability, analytics, debugging, visual projections, and integration. Life OS is **not** full event sourcing: current-state tables remain canonical for current state.

## 11.5 Transactional outbox

Commands that create asynchronous side effects append an `outbox_messages` record in the same PostgreSQL transaction as the domain state change. Push or metric processing can fail without rolling back already-correct domain truth.

# 12. Standard API error contract

Purpose-specific read endpoints return screen-oriented read models. Mutations use command endpoints.

Common errors include:

| HTTP | Code | Purpose |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Invalid request structure |
| 401 | `AUTH_REQUIRED` | No valid actor session |
| 403 | `FORBIDDEN` | Authenticated but unauthorized |
| 404 | `RESOURCE_NOT_FOUND` | Missing or intentionally non-disclosed resource |
| 409 | `STALE_VERSION` | Concurrent edit |
| 409 | `IDEMPOTENCY_KEY_REUSE` | Same command ID, different content |
| 409 | `RESOURCE_STATE_CHANGED` | Offline command no longer valid in the same form |
| 409 | `JOB_TERMS_CHANGED` | Child has not accepted new terms |
| 422 | `DOMAIN_RULE_VIOLATION` | Business invariant prevents action |
| 422 | `INSUFFICIENT_FUNDS` | Ledger constraint |
| 429 | `RATE_LIMITED` | Abuse/credential protection |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |

# 13. Offline synchronization contract

## 13.1 Durable local intent

The offline mutation order is:

```text
Persist command locally
        |
Apply safe optimistic projection
        |
Attempt network when possible
```

This guarantees that once the UI confirms that an action was saved locally, reload/crash does not silently lose it.

## 13.2 Batch sync

```text
POST /api/v1/sync/commands
```

submits ordered commands, initially capped at a reasonable batch size such as 50. Each command has its own transaction. One conflict does not reject unrelated commands.

Dependent commands can be marked blocked until their prerequisite conflict is resolved.

## 13.3 Sync triggers

Synchronization runs on app start, connectivity return, foreground/resume, new command creation while online, manual retry, and periodic retry while the app is open. Browser Background Sync is an optional optimization, never a correctness dependency.

# 14. Scheduler architecture

Supabase Cron invokes a signed internal system endpoint. Sub-jobs are individually idempotent and include:

- materialize upcoming activity instances;
- move expired pending opportunities to `AWAITING_RESOLUTION`;
- create reminder intents;
- process outbox work;
- create weekly reviews;
- create graduation-monitoring prompts;
- evaluate autonomy/graduation evidence;
- refresh selected metric projections.

A scheduler-run uniqueness key protects against duplicate execution of the same logical time bucket.

# 15. V1.2 - Frontend and PWA architecture

## 15.1 Client state ownership

| State class | Owner |
|---|---|
| Canonical state | PostgreSQL |
| In-memory online server cache | TanStack Query |
| Durable offline read data | Dexie / IndexedDB |
| Durable pending intent | Dexie command outbox |
| Temporary UI state | React |
| Form state | React Hook Form |
| Static/app shell resources | Service Worker Cache Storage |

Redux is intentionally not introduced for the MVP because it would duplicate either server state or durable IndexedDB state.

## 15.2 Why domain mutations remain Route Handler commands

Although Next.js supports Server Actions, Life OS domain mutations require stable, replayable HTTP contracts that can be created offline, persisted, retried idempotently, and potentially reused by future native clients. Therefore domain mutations remain explicit API commands.

## 15.3 Route trees

Parent and child use separate route trees because navigation density, authorization, data persistence, and visual treatment differ:

```text
/parent/...
/child/...
```

Shared primitives and domain components remain reusable.

## 15.4 Query keys are actor-scoped

Examples:

```text
['child', childId, 'home']
['child', childId, 'today', date]
['child', childId, 'money']
['family', familyId, 'world']
['parent', familyId, 'home']
```

Generic keys such as `['money']` are forbidden because profile switching could expose stale sibling data.

# 16. IndexedDB / Dexie architecture

The local database contains:

```text
snapshots
commandOutbox
conflicts
syncState
actorState
preferences
deviceState
```

Selected server read models are explicitly persisted; the entire TanStack Query cache is not blindly persisted because data is actor-sensitive, privacy-sensitive, schema-versioned, and not equally suitable for durable storage.

Pending commands never expire automatically. They remain until accepted, explicitly resolved, or deliberately discarded after an authorized conflict decision.

# 17. Optimistic UI policy

Three optimism levels are used:

| Level | Behavior | Examples |
|---|---|---|
| A - Safe | Immediately predict | mark activity done, local draft update |
| B - Provisional | Show predicted result with pending status | goal progress, job submission, money allocation preview |
| C - Server only | Never predict authoritative result | XP grant, job credit, autonomy, graduation, server suggestion |

The client may predict presentation but never invent domain meaning.

# 18. Service worker and caching

Service Worker owns application-shell/static caching, offline navigation fallback, push events, notification clicks, and optional background-sync triggers. It does not contain domain rules.

Recommended strategies:

| Resource | Strategy |
|---|---|
| Versioned JS/CSS | Cache First |
| Icons/theme assets | Cache First |
| Fonts | Cache First |
| Navigation shell | Network First with offline fallback |
| Manifest | Stale While Revalidate |
| API GET domain data | Structured persistence in IndexedDB rather than relying on Cache Storage |
| API POST commands | Never cached |

# 19. Shared-device privacy

A personal child device may persist child-scoped offline data. A personal guardian device may persist authorized guardian views. A shared family tablet should avoid durable caching of sensitive guardian-only information such as sibling-private analytics, audit records, wallet corrections, or private observations.

# 20. Visual World architecture

The Visual World is a presentation engine, not business logic.

```text
Domain event
    |
Semantic impact
    |
Story interpretation / milestone
    |
World read model
    |
Experience profile
    |
Theme mapping + motion policy
    |
Rendered scene
```

The backend stores semantic progress and unlocks, not screen coordinates or animation instructions.

## 20.1 Personal and family worlds

The same rendering engine supports two scopes:

- **Personal World** - skills, goals, independence, saving, personal milestones.
- **Family World** - family contributions, shared goals, meaningful shared moments.

## 20.2 Island MVP mapping

The first theme is an Island/Growing World. Areas have meaning rather than being random decoration:

```text
Home / path / bridge       -> independence
Library / tower            -> learning and skills
Harbor / vault             -> money and saving
Giving garden              -> generosity/giving history
Family garden / tree       -> shared family contribution
Observatory / peak         -> goals and mastery
```

## 20.3 Story architecture

Story uses curated semantic beats rather than generative AI for the MVP:

```text
NEW_BEGINNING
PROGRESS
MILESTONE
RECOVERY
GRADUATION
FAMILY_CONTRIBUTION
KINDNESS_MOMENT
GOAL_ACHIEVED
```

A single semantic event can render differently by experience profile. A graduation may be a bridge completion for an Explorer, an island area unlock for a Builder, and a milestone card for a Focused teen.

## 20.4 Visual tools

MVP tooling:

| Need | Tool |
|---|---|
| Main world and objects | SVG |
| Simple element motion | CSS + Web Animations API |
| One-shot authored celebrations | optional Lottie/dotLottie |
| Interactive avatar / advanced stateful objects | Rive, introduced only when complexity justifies it |
| Full game engine | Not required |

The MVP should not use Canvas/WebGL as the primary world surface because DOM/SVG provides better accessibility, responsiveness, testing, and component integration.

## 20.5 Milestone aggregation

Every action does not create another permanent object. Detailed history remains in events and Story/Moments; the world displays aggregated milestones so it does not become visually saturated after months or years.

# 21. V1.3 - Cross-cutting production architecture

V1.3 completes the baseline architecture with security, privacy, internationalization, release, and operational requirements.

# 22. Security threat model

The main protected assets are:

- child and family private data;
- child/guardian sessions;
- financial ledger integrity;
- family isolation;
- autonomy/graduation decisions;
- audit history;
- offline pending commands.

Principal threat categories and mitigations:

| Threat | Example | Core mitigation |
|---|---|---|
| Spoofing | Child pretends to be guardian | separate guardian auth, parent unlock, server actor resolution |
| Broken authorization | Malika reads Eyad wallet | actor/resource/family checks on every protected request |
| Tampering | Browser changes XP amount | client never sends authoritative XP; server domain computes it |
| Replay | offline command sent twice | unique command IDs + request hashes |
| Stale overwrite | two guardians edit same activity | optimistic version checks + 409 conflict |
| Ledger corruption | edit prior transaction | append-only permissions + correction transactions |
| Information disclosure | shared tablet caches parent analytics | device-aware persistence policy |
| Credential guessing | child PIN brute force | device binding, Argon2id, attempt counter, cooldown |
| Injection | malformed API payload | Zod validation + parameterized ORM queries |
| XSS | malicious text in Moment | escaped React rendering, CSP, no arbitrary HTML |
| CSRF | forged browser mutation | SameSite cookies + CSRF/origin policy for state-changing requests |
| DoS/abuse | repeated PIN/API attempts | credential-specific lockout + platform/app rate limits |

# 23. Session and credential defaults

These values are **configurable security defaults**, not permanent product laws.

## 23.1 Guardian session

Recommended baseline:

- secure HTTP-only cookie/session through Supabase integration;
- idle/re-authentication policy for sensitive parent operations;
- explicit logout and device revocation;
- short parent-unlock window on shared child devices (for example 10-15 minutes).

## 23.2 Child PIN

Recommended MVP default:

- 4-6 digit child PIN appropriate to age;
- PIN only works on a previously enrolled household device;
- Argon2id hash stored server-side;
- after 5 failed attempts, temporary lock/cooldown (for example 15 minutes);
- guardian can reset the PIN;
- PIN cannot be used as an internet-wide login credential.

The architecture makes the low-entropy PIN safe by constraining where it is accepted.

# 24. Security headers and CSP

Next.js responses should apply a strict baseline including:

```text
Content-Security-Policy
X-Content-Type-Options: nosniff
Referrer-Policy
Permissions-Policy
frame-ancestors / clickjacking protection
HSTS in production
```

CSP should avoid `unsafe-eval` in production and tightly control script, image, style, font, connect, worker, and frame sources. Introducing Rive/Lottie/CDN assets later must update CSP intentionally rather than loosening it globally.

# 25. Rate limiting

MVP does not require a dedicated Redis service. Protection is layered:

- Supabase Auth/provider protections for guardian login;
- persistent failed-attempt/cooldown fields for child PIN;
- Vercel/platform-level request protection where available;
- application-level limits on high-risk endpoints such as child-session creation, parent unlock, command batch size, and push subscription creation.

If commercial traffic later requires distributed fine-grained limits, add a managed Redis/KV rate-limit store without changing domain contracts.

# 26. Privacy and data minimization

MVP child data should be limited to what directly serves the product:

```text
name/nickname
birth date
avatar selection
activity and goal history
money ledger
Moments
family relationships
review/reflection data
```

Do not collect exact GPS, home address, school location, contacts, microphone recordings, camera monitoring, advertising IDs, or public social-profile data by default.

No third-party advertising or behavioral ad SDK is included.

# 27. Data retention baseline

Retention should distinguish business truth from operational logs.

Recommended defaults:

| Data | Baseline |
|---|---|
| Domain history / financial ledger | retained while account/family exists, subject to lawful deletion requirements |
| Archived activities/goals | retained as history unless permanent family deletion is requested |
| Audit records | retained long enough for family/support integrity; configurable for commercial policy |
| Application logs | short-lived, target ~30 days or platform default |
| Failed outbox diagnostic payloads | limited retention after resolution |
| Push subscriptions | deleted/revoked with device/session removal |
| Deactivated child profile | retained but inaccessible until explicit permanent-deletion workflow |

A public/commercial product must replace these baseline values with jurisdiction-aware legal retention and deletion policies.

# 28. Backup and recovery

## 28.1 Family pilot

On free infrastructure, use periodic encrypted manual exports and take a fresh backup before risky schema migrations or major releases.

## 28.2 Commercial baseline

Upgrade to automated backups and point-in-time recovery where required. Define:

```text
RPO - acceptable data-loss window
RTO - acceptable restoration time
```

For a paid family product, target values should eventually be explicit rather than aspirational.

## 28.3 Restore testing

A backup is not considered valid until a restore has been tested in a non-production environment. Restore drills should verify schema, financial ledgers, command idempotency records, and authentication/family mappings.

# 29. Observability and logging

MVP observability uses:

- Vercel application/runtime logs;
- Supabase/PostgreSQL logs;
- structured JSON application logs;
- scheduler-run status;
- outbox failure status;
- audit log for sensitive domain changes.

Every request receives a `request_id`; every mutation has a `command_id`. Logs must not include child PINs, raw session tokens, passwords, or unnecessarily full Moment/reflection text.

Recommended structured fields:

```text
requestId
commandId
actorKind
familyId (internal identifier)
route/operation
status
latencyMs
errorCode
```

# 30. Health and operational checks

Provide internal health checks for:

- API availability;
- database connectivity;
- scheduler recency;
- oldest unprocessed outbox age;
- failed outbox count;
- migration/schema version.

Do not expose private dependency or family details through public health endpoints.

# 31. Feature flags and configuration

Use two classes of configuration:

## 31.1 Deployment configuration

Environment variables / secret manager:

```text
DATABASE_URL_RUNTIME
DATABASE_URL_MIGRATION
SUPABASE_AUTH configuration
VAPID keys
internal scheduler secret
public base URL
```

## 31.2 Product configuration

Database-backed, versioned configuration for changeable product defaults:

```text
autonomy evidence thresholds
graduation evidence thresholds
minimum data coverage
notification timing defaults
age-profile defaults
visualization defaults
```

Behavioral thresholds are configuration, not scattered hard-coded constants.

# 32. Internationalization - Arabic and English

Arabic/English support is an architectural requirement from the MVP rather than a translation afterthought.

Recommended locale baseline:

```text
en
ar-EG
```

Use a structured message catalog with ICU-style variable/plural handling (for example through a Next.js-compatible i18n library such as `next-intl`). Business/domain error codes remain language-neutral; the client maps them to localized copy.

## 32.1 Directionality

At the document/screen level:

```text
English -> dir="ltr"
Arabic  -> dir="rtl"
```

Use CSS logical properties (`margin-inline`, `padding-inline`, `inset-inline`, `border-inline-start`) rather than hard-coded left/right layout rules.

For unavoidable embedded LTR fragments inside Arabic UI - numbers, email addresses, URLs, English names - use direction-isolation patterns such as `<bdi>` / appropriate `dir` attributes instead of mixing unisolated RTL/LTR text in one line.

## 32.2 Visual-world localization

The world itself should rely primarily on universal visual semantics. Story-card text and labels are localized independently. Asset geometry must not encode English words directly into artwork.

# 33. Locale, calendar, and time rules

Use Gregorian dates for system scheduling in MVP, formatted by locale. Do not build recurrence around formatted date strings.

All recurrence uses:

```text
IANA timezone
+ local target time
+ recurrence rule
```

Arabic locale may display Arabic/Egyptian formatting, but canonical timestamps remain UTC. Hijri-calendar display can be added later as a presentation option without changing stored occurrence semantics.

# 34. Accessibility baseline

Accessibility is cross-cutting:

- semantic HTML;
- keyboard navigation;
- visible focus;
- screen-reader labels;
- adequate contrast;
- large touch targets;
- no meaning conveyed by color alone;
- reduced motion;
- visual-world information available in non-animated/text form.

OS `prefers-reduced-motion` takes precedence over more animated app defaults.

# 35. Release and migration strategy

Use three environments:

```text
Local
Development cloud
Production
```

CI performs type checking, domain/unit tests, PostgreSQL integration tests, application build, and critical Playwright flows before production promotion.

Database changes are version-controlled migrations. Prefer expand-contract migrations:

```text
add new schema/column
support old + new
migrate data
switch application
remove old path later
```

This avoids deployment-order failures.

# 36. PWA and command compatibility across releases

Pending offline commands may survive application upgrades, therefore every command carries a `schemaVersion`. The server should understand a short compatibility window of older command versions or return an explicit `CLIENT_UPDATE_REQUIRED` only when safe interpretation is impossible.

Static PWA cache versions and IndexedDB schema versions are independent. A frontend release must never wipe pending commands as part of routine cache cleanup.

# 37. Disaster and degraded-mode behavior

The product must fail safely:

| Failure | Expected behavior |
|---|---|
| Internet down | cached app remains usable; commands queue locally |
| Push down | domain state remains correct; user may simply miss reminder |
| Analytics projection fails | core actions continue; projection recalculated later |
| Visual renderer fails | Today/tasks remain usable; world component error boundary |
| Cron delayed | no duplicate task generation; jobs catch up idempotently |
| Database unavailable | commands remain local on client; server writes fail atomically |
| App update available | do not force reload mid-form; pending commands stay durable |

# 38. Commercial scaling path

The current architecture intentionally delays distributed complexity. Likely scaling steps are:

1. **Family pilot:** Vercel Hobby + Supabase Free/low-cost; one modular monolith.
2. **Early product:** paid Vercel/Supabase, automated backups, stricter monitoring, support tooling, formal privacy/compliance.
3. **Growing product:** dedicated queue/rate-limit infrastructure, read replicas/optimized projections as needed, asset CDN expansion, worker separation for heavy asynchronous processing.
4. **Large scale:** extract only proven hotspots (notifications, analytics/projection workers, media processing) into separate services while retaining domain contracts.

Do not preemptively split the core behavioral domain into microservices.

# 39. Security and privacy invariants

The following are architecture invariants:

```text
Browser is untrusted.
No direct browser writes to domain tables.
Every protected operation resolves actor server-side.
Every family-owned query is tenant-scoped.
Child sessions are scoped to one child/device/family.
Sibling-private resources are server-isolated.
Client cannot specify authoritative XP or money effects.
Financial history is append-only.
Command replay is idempotent.
Stale configuration edits do not silently overwrite.
Pending offline commands are not auto-deleted.
Sensitive guardian data is not persistently cached on shared child devices.
No child email/phone identity is required for the MVP.
No advertising or surveillance SDKs are part of the architecture.
```

# 40. Frontend/PWA invariants

```text
All domain mutations use commands.
Commands are stored locally before network submission.
Dexie commandOutbox is the only durable offline mutation queue.
TanStack mutation persistence is not a second domain queue.
TanStack Query owns in-memory server-state caching.
Dexie owns structured offline snapshots and pending intent.
Cache Storage owns static/app resources.
Query keys are actor-scoped.
Server effects determine XP/money/autonomy/graduation.
Visual themes consume semantic world state rather than creating meaning.
Background Sync is optional.
No Redux initially.
```

# 41. Data/API invariants

```text
Private PostgreSQL application schema.
Runtime uses Drizzle + node-postgres + transaction pooler.
UUIDv7 generated application-side.
Money uses integer minor units.
Double-entry internal ledger.
Domain events are append-only but the system is not full event sourcing.
One command normally maps to one DB transaction.
Mutable aggregates use optimistic versions.
Read endpoints return purpose-built view models, not raw rows.
Behavioral decisions live in TypeScript domain rules, not database triggers.
```

# 42. Architecture decision record summary

| ADR | Decision |
|---|---|
| A-001 | PWA-first rather than native-first |
| A-002 | Next.js modular monolith |
| A-003 | PostgreSQL/Supabase rather than Firestore |
| A-004 | No direct browser access to domain tables |
| A-005 | Guardian Auth + internal child-scoped sessions |
| A-006 | Command/query API separation |
| A-007 | Durable custom Dexie command outbox |
| A-008 | Optimistic concurrency for mutable config |
| A-009 | Double-entry append-only money ledger |
| A-010 | Domain events without full event sourcing |
| A-011 | Transactional outbox for async side effects |
| A-012 | SVG-first visual world, semantic theme mapping |
| A-013 | English + Arabic/RTL architectural support from MVP |
| A-014 | No microservices until measured need |

# 43. End-to-end write path

```text
User action
   |
React UI / form
   |
create UUIDv7 command
   |
Dexie commandOutbox (durable first)
   |
safe optimistic presentation
   |
SyncCoordinator
   |
POST command / batch
   |
resolve server ActorContext
   |
authorize
   |
check idempotency
   |
BEGIN PostgreSQL transaction
   |
load aggregate + check version
   |
execute domain rule
   |
write current state
append ledger/event records
append outbox side effect
mark command processed
   |
COMMIT
   |
return semantic/canonical result
   |
remove local pending command
refetch affected read models
persist selected snapshot
render semantic visual effect
```

# 44. End-to-end read path

```text
Screen opens
   |
actor-scoped query hook
   |
load selected Dexie snapshot if available
   |
render immediately
   |
if online, fetch purpose-built read model
   |
TanStack Query cache update
   |
persist allowed snapshot
   |
render fresh canonical state
```

# 45. End-to-end visual-world path

```text
Domain fact
   |
Semantic impact
   |
Milestone / Story beat
   |
World read model
   |
Effective experience profile
   +-- age default
   +-- selected visualization level
   +-- motion preference
   +-- OS accessibility preference
   |
Island theme mapping
   |
SVG / animation renderer
```

# 46. Implementation order implied by this architecture

A sensible implementation sequence is:

1. project skeleton, environment, test harness;
2. identity/family/guardian auth;
3. child profiles, trusted devices, child-scoped sessions;
4. private PostgreSQL schema + command/event/outbox foundations;
5. activities and recurrence;
6. PWA shell + Dexie + offline command queue;
7. progress/recovery projections;
8. goals;
9. jobs and double-entry wallet;
10. autonomy/graduation/suggestions;
11. Moments/Weekly Review;
12. Visual World semantic projection + Island MVP;
13. push notifications and scheduler hardening;
14. Arabic/English polish, accessibility, observability, backup/recovery hardening.

# 47. What remains for Implementation Specification

Architecture is now sufficiently frozen to begin an implementation specification. The implementation phase should define:

```text
exact repository/file tree
exact Drizzle schemas and migrations
exact Zod command/query contracts
exact aggregate/repository interfaces
exact auth/session middleware
exact Dexie TypeScript schemas
exact query keys/hooks
exact service-worker implementation
exact component design tokens
exact visual asset naming/mapping
exact test suites and fixtures
feature-by-feature delivery epics
coding-agent master prompt
```

Architecture should only be reopened when implementation exposes a genuine contradiction, security flaw, or unacceptable operational cost.

# References

- Next.js documentation - App Router, Route Handlers, PWA guidance: https://nextjs.org/docs
- Supabase documentation - PostgreSQL, Auth, pooling, private/custom schemas, Cron: https://supabase.com/docs
- PostgreSQL documentation - UUID, transactions, locking and queue patterns: https://www.postgresql.org/docs/
- Drizzle ORM documentation - PostgreSQL and node-postgres: https://orm.drizzle.team/docs/get-started-postgresql
- TanStack Query documentation - network modes and React Query architecture: https://tanstack.com/query/latest/docs/framework/react
- Dexie documentation - IndexedDB, schema versions and transactions: https://dexie.org/docs/
- MDN - Service Workers, PWA caching, Web Animations, reduced motion: https://developer.mozilla.org/
- WebKit - Web Push for iOS/iPadOS Home Screen web apps: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- OWASP Cheat Sheet Series - authorization, sessions, CSP and web security patterns: https://cheatsheetseries.owasp.org/
- Rive - interactive vector/state-machine runtime: https://rive.app/
- LottieFiles/dotLottie - authored vector animation runtimes: https://docs.lottiefiles.com/