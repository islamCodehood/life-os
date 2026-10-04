# Life OS Application — AGENTS.md Template

Copy this file to the root of the future `life-os` application repository as `AGENTS.md`.

## Mission

Implement Life OS for Kids as an offline-capable family PWA that helps children progressively become more independent. The system should become less necessary as responsibility becomes internalized.

## Authoritative order

1. System Design V0.1–V0.4 — product/domain behavior.
2. System Architecture V1.0–V1.3 — technical boundaries.
3. Implementation Specification V2.0–V2.3 — implementation contract.
4. `@life-os/design-system` Storybook V3.3 — production UI/state contract.
5. MagicPath V3.3 — approved composition/flow reference.
6. Current task acceptance criteria.

Never silently resolve a contradiction. Record it and preserve the higher-precedence contract.

## Non-negotiable domain invariants

- XP never converts to money.
- Money never buys XP or moral progress.
- Values do not generate XP or money.
- Faith does not generate XP or money by default.
- Normal self/family responsibilities do not generate money.
- Paid work is represented by Job.
- No negative/punishment XP.
- Corrections may reverse erroneous XP but are not punishment.
- Misses never erase prior progress.
- Unknown/unreported is not automatically Missed.
- Excused/NotApplicable/paused opportunities do not reduce consistency.
- Recovery is recognized without recovery-only XP.
- No sibling leaderboard.
- No morality/global child score.
- Age supplies defaults, never automatic capability/autonomy.
- Autonomy, graduation, and reactivation require authorized guardian decisions.
- Financial history is append-only; corrections are compensating entries.
- Visual presentation never changes domain logic.
- Every meaningful action has one primary semantic meaning.

## Architecture invariants

- One Next.js modular-monolith repository and one deployable app for MVP.
- Pure TypeScript domain code must not import React, Next.js, Drizzle, Supabase, Dexie, Vercel, or browser APIs.
- Browser code never accesses the private `life_os` PostgreSQL schema directly.
- Domain mutations use HTTP command APIs, not Server Actions or direct CRUD.
- Commands use durable `commandId`, schema version, `occurredAt`, optional expected versions, and server-resolved actor context.
- PostgreSQL is canonical.
- IndexedDB/Dexie stores actor-scoped snapshots and durable pending intent.
- Dexie `commandOutbox` is the only durable offline mutation queue.
- TanStack Query is an in-memory server-state cache.
- Money uses integer minor units and a double-entry ledger.
- Domain events are append-only; this is not full event sourcing.
- Asynchronous effects use a transactional outbox.
- Read APIs return presentation-ready DTOs, not database rows.
- Stale meaningful writes never silently last-write-win.
- Query keys and durable local data are actor scoped.

## Security

- Derive `ActorContext` server-side.
- Treat all browser input as untrusted.
- Family-scope every tenant-owned repository operation.
- Enforce guardian/child authorization on the server.
- Use Zod at external boundaries.
- Never log secrets, PINs, raw session tokens, auth tokens, or sensitive reflections.
- Keep private database/service credentials out of browser bundles.

## Offline rules

- Persist command intent before claiming it is safely accepted locally.
- Preserve real `occurredAt` when offline.
- Replay must be idempotent.
- Pending commands remain until accepted or explicitly resolved.
- Network failure is not child behavioral failure.
- Typed conflicts require explicit resolution.
- Never fabricate authoritative money balance optimistically.

## Frontend / UI

- Use Next.js App Router.
- Use `@life-os/design-system` for frozen production UI.
- Storybook wins over MagicPath for exact component rendering.
- MagicPath clarifies product composition and flow only.
- TanStack Query for server-state cache.
- Dexie for durable structured offline state.
- React Hook Form + Zod for forms.
- No Redux unless a later ADR explicitly introduces it.
- English and Arabic from E0.
- Use logical CSS properties and bidi isolation.
- Preserve reduced-motion behavior.
- Do not duplicate design-system CSS or Visual World assets in the app.

## Implementation style

- Prefer explicit, boring, testable code.
- Keep Route Handlers thin.
- Keep domain rules centralized and unit tested.
- No generic `services.ts`, `helpers.ts`, or `utils.ts` dumping grounds when code has a clear domain home.
- Do not reorganize unrelated modules during a scoped task.
- Use migrations for database changes.
- Do not introduce dependencies without explaining why the approved stack cannot solve the need.
- Update tests with every changed domain behavior.

## Task workflow

Before coding:
1. Read the relevant frozen references.
2. Identify domain invariants affected.
3. Identify actor permissions.
4. Identify offline behavior.
5. Identify persistence/migration impact.
6. Identify required tests.

After coding, report:
- files changed;
- migrations added;
- domain rules implemented;
- tests added/results;
- unresolved ambiguities;
- deviations from specification, normally none.

## First implementation target

Do not build the whole product. Complete E0 first, then E1, then the `SELF_MAKE_BED` vertical slice.

The first pilot loop is:
real responsibility → durable child action → server interpretation → progress/recovery → visual impact → parent insight.
