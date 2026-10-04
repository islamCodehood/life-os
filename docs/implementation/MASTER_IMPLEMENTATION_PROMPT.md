# Master Implementation Prompt — Life OS Application

Use this as the repository-level master instruction for a coding agent working in the future `life-os` application repository. A task-specific prompt must always narrow the scope further.

## Role

You are implementing Life OS for Kids, an offline-capable family PWA. Your job is to execute the frozen product, architecture, implementation, and UI contracts without inventing behavior.

## Authoritative order of precedence

1. System Design V0.1–V0.4 — product/domain behavior.
2. System Architecture V1.0–V1.3 — technical boundaries.
3. Implementation Specification V2.0–V2.3 — implementation contract.
4. `@life-os/design-system` Storybook V3.3 — exact UI/state contract.
5. MagicPath project “Life OS — App UI V3.3” — composition/flow reference only.
6. Current task's explicit acceptance criteria.

If two instructions conflict, do not silently choose. Preserve the higher-precedence source and report the contradiction.

## Product purpose

Life OS helps children progressively become more independent. It should make growth visible without converting family life, character, faith, kindness, or ordinary responsibility into a reward economy.

The long-term success state is that the child needs less active tracking.

## Non-negotiable domain invariants

- XP never converts to money.
- Money never buys XP or moral progress.
- Values do not generate XP or money.
- Faith does not generate XP or money by default.
- Normal self/family responsibilities do not generate money.
- Paid work is represented by Job.
- No negative/punishment XP.
- Erroneous XP may only be reversed through auditable correction.
- Misses do not erase previously earned progress.
- Unknown/unreported is not automatically Missed.
- Excused, NotApplicable, and paused opportunities do not reduce consistency.
- Recovery may be recognized but does not receive XP solely for recovery.
- No sibling leaderboard or direct sibling ranking.
- No morality score or global child score.
- Age supplies defaults, not automatic autonomy.
- Autonomy/graduation/reactivation require authorized guardian decisions.
- Graduated responsibilities remain guardian-visible for lightweight monitoring.
- Financial history is append-only and corrected through compensating entries.
- Visual theme/presentation never changes domain logic.
- Every meaningful action has one primary semantic meaning.
- App engagement is not a child-development success metric.
- Notification delivery is not behavioral truth.
- Offline intent remains durable until accepted or explicitly resolved.

## Architecture invariants

- MVP is a modular monolith in one application repository.
- Pure domain TypeScript must not import React, Next.js, Drizzle, Supabase, Dexie, Vercel, or browser APIs.
- Browser never accesses private `life_os` PostgreSQL tables directly.
- Domain mutations use replayable HTTP Route Handler command APIs, not Server Actions.
- All commands are idempotent by `commandId + request hash`.
- Mutable configuration uses optimistic versions; do not silently last-write-win stale edits.
- PostgreSQL is canonical.
- IndexedDB/Dexie stores cached read models and durable pending intent.
- Dexie `commandOutbox` is the only durable offline mutation queue.
- TanStack Query is in-memory server-state cache.
- Money uses integer minor units and internal double-entry accounting.
- Domain events are append-only but the product is not full event sourcing.
- Asynchronous effects use transactional outbox semantics.
- Query APIs return presentation-ready DTOs rather than raw DB rows.
- Query keys and local durable data are actor scoped.
- Sensitive guardian data is not durably persisted on shared child devices by default.

## Security contract

- Treat browser input as untrusted.
- Resolve `ActorContext` from credentials/session server-side.
- Family-scope every tenant-owned repository operation.
- Child access is own private data + explicitly shared family resources only.
- Parent/guardian privileges are server-enforced.
- Validate external boundaries with Zod.
- Do not expose internal stack traces or DB errors.
- Do not log PINs, raw cookies/tokens, secrets, private keys, or sensitive Moment/reflection text by default.

## Offline contract

- Persist a command in IndexedDB before presenting it as safely accepted locally.
- Retain real-life `occurredAt`.
- Replay must never duplicate XP, money, progress, events, or ledger entries.
- Pending commands do not expire silently.
- Generic network failure is not behavioral failure.
- Conflicts are typed and resolved intentionally.
- Money may show pending intent but never an authoritative optimistic balance mutation.

## Frontend contract

- Next.js App Router.
- React version supported by the pinned Next.js line.
- TypeScript strict.
- TanStack Query v5.
- Dexie/IndexedDB.
- React Hook Form + Zod.
- No Redux for MVP unless a later ADR introduces it.
- English and Arabic from E0.
- Use logical CSS properties and bidi isolation.
- Respect reduced motion.
- Production UI must come from `@life-os/design-system`.
- Storybook V3.3 is the exact visual/state contract.
- MagicPath V3.3 clarifies hierarchy and flow but prototype-local UI must not be copied when the design-system equivalent exists.

## Design-system dependency

Until a registry release flow exists, pin the public GitHub design-system dependency to a reviewed commit, not to floating `main`.

Current handoff commit:

`islamCodehood/life-os-design-system@b69e66f589b80faf9968a2ace0e08737bfc2b8f0`

Import production UI from the package and its exported stylesheet.

## Approved baseline at bootstrap

- Node.js 24 LTS.
- Next.js 16 Active LTS, latest security-patched 16.3 line at bootstrap.
- pnpm.
- Supabase PostgreSQL.
- Drizzle ORM + `pg`.
- Supabase Auth behind an application adapter.
- Zod.
- TanStack Query v5.
- Dexie.
- React Hook Form.
- Vitest.
- Playwright.
- Vercel.
- GitHub Actions.

Pin resolved versions and commit `pnpm-lock.yaml`; do not use floating `latest` in committed critical dependencies.

## Repository topology

Use this shape:

```text
life-os/
├─ app/
│  ├─ (public)/
│  ├─ (app)/
│  │  ├─ parent/
│  │  └─ child/
│  ├─ api/
│  │  ├─ v1/
│  │  └─ internal/
│  ├─ manifest.ts
│  └─ layout.tsx
├─ src/
│  ├─ modules/
│  │  ├─ family/
│  │  ├─ activities/
│  │  ├─ progress/
│  │  ├─ goals/
│  │  ├─ jobs/
│  │  ├─ money/
│  │  ├─ moments/
│  │  ├─ autonomy/
│  │  ├─ reviews/
│  │  └─ visual-world/
│  ├─ application/
│  │  ├─ commands/
│  │  ├─ queries/
│  │  └─ auth/
│  ├─ domain/
│  │  ├─ shared/
│  │  └─ policies/
│  ├─ infrastructure/
│  │  ├─ database/
│  │  ├─ auth/
│  │  ├─ push/
│  │  ├─ scheduler/
│  │  └─ logging/
│  ├─ offline/
│  │  ├─ db/
│  │  ├─ outbox/
│  │  ├─ sync/
│  │  └─ conflicts/
│  ├─ ui/providers/
│  ├─ i18n/
│  └─ shared/
├─ drizzle/
├─ public/themes/island/
├─ tests/
│  ├─ domain/
│  ├─ application/
│  ├─ integration/
│  ├─ offline/
│  └─ e2e/
├─ docs/
├─ scripts/
├─ drizzle.config.ts
├─ next.config.ts
├─ playwright.config.ts
├─ vitest.config.ts
├─ tsconfig.json
└─ package.json
```

## Dependency direction

Presentation/UI → application commands/queries → pure domain → repository/gateway interfaces ← infrastructure implementations.

Never invert this.

## Core primitive conventions

- Branded IDs in TypeScript; UUIDv7 at runtime.
- ISO strings across API/cross-layer boundaries.
- Persist timestamps UTC; evaluate recurring schedules in IANA timezones.
- Distinguish `occurredAt`, `recordedAt`, and `effectiveFrom`.
- Money is `bigint` minor units internally and decimal strings in JSON.
- `ActorContext` is server resolved and never trusted from request body.
- All mutations use one command envelope with command ID, schema version, occurredAt, optional client sequence, expected versions, and payload.

## Implementation style

- Prefer explicit, boring, testable code.
- Keep Route Handlers thin.
- Centralize domain rules.
- Use repository interfaces; infrastructure implements them.
- Avoid generic dumping-ground files.
- Do not reorganize unrelated modules during a scoped task.
- Use migrations; never manually edit production schema.
- Introduce dependencies only when the approved stack is insufficient and explain why.
- Add tests before considering domain behavior complete.

## Coding-agent guardrails

Do not:
- invent business rules;
- bypass repositories/application handlers;
- access private domain tables from browser code;
- replace command APIs with direct CRUD or Server Actions;
- create XP/money behavior unless explicitly allowed;
- create negative XP/punishment deductions;
- add sibling ranking/global child score;
- silently resolve stale version conflicts;
- UPDATE/DELETE financial history;
- auto-approve autonomy or graduation;
- treat missing data as failure;
- turn engagement/streaks into the product goal;
- persist sensitive guardian data on shared child devices without explicit policy;
- create destructive migrations without explicit approval;
- copy MagicPath prototype components instead of design-system components.

Always:
- use existing vocabulary/state machines;
- add/update tests;
- record ambiguity rather than invent behavior;
- report deviations.

## Task protocol

Before coding:
1. Read the task-specific prompt.
2. Read relevant frozen specification sections.
3. Identify invariants, actor permissions, offline behavior, persistence impact, and tests.
4. Confirm exact scope and out-of-scope boundaries.

After coding report:
- files changed;
- migrations;
- domain behavior implemented;
- tests and results;
- unresolved ambiguity;
- deviations.

## Build order

E0 Foundation → E1 Identity/sessions → E2 Make Bed vertical slice → E3 offline completion → E4 reminders/independence/recovery → later epics.

Do not skip E0 gates and do not generalize the entire activity catalog before `SELF_MAKE_BED` works end-to-end.
