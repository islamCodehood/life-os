# Epic 3 Prompt — Offline Make Bed Completion + Replay

Implement E3 on top of merged E2. Keep the slice strictly limited to making the existing `SELF_MAKE_BED` completion reliable when connectivity is unavailable or transient.

## Goal

A child can mark the existing Make Bed activity complete while offline. The app must persist that real-world intent locally before presenting it as safely accepted, show an optimistic pending/offline state, replay the exact same command when connectivity returns, and converge on the server's canonical state without duplicating completion records or domain events.

## In scope

- Dexie `LifeOSLocal` database groups required by the frozen offline contract:
  - `snapshots`
  - `commandOutbox`
  - `conflicts`
  - `syncState`
  - `actorState`
  - `preferences`
  - `deviceState`
- actor/device-scoped offline command records
- atomic local `clientSequence` allocation with command persistence
- client `executeCommand()` facade for `CompleteActivity`
- Make Bed UI no longer calling `/api/v1/commands` directly
- optimistic completed presentation with pending/offline sync state
- replay through the existing idempotent command API
- preserve the original `occurredAt`
- recover commands left in `SYNCING` after interruption
- retry transient network/server failures without losing intent
- typed persistence of `STALE_VERSION` / `RESOURCE_STATE_CHANGED` conflicts
- explicit retained `FAILED` state for deterministic rejections
- stop replay behind an unresolved conflict instead of blindly continuing
- sibling/profile isolation of durable queues
- abort/suspend replay when the active child actor changes
- tests for facade ordering, actor scoping, replay, retry, conflict blocking, and interrupted-sync recovery

## Out of scope

- new activity/task types
- generic task catalog/builder
- offline guardian setup commands
- XP award processing
- money/rewards
- reminders
- recovery metrics
- graduation
- Visual World progression
- a new business rule for resolving conflicts
- broad offline caching of guardian/private screens
- changing service-worker POST behavior; service workers must not cache domain mutations

## Required invariants

- PostgreSQL remains canonical.
- IndexedDB holds durable intent and selected local state, not alternative business truth.
- A command must be in IndexedDB before the UI claims it is safely saved.
- Replay uses the original `commandId`, payload, versions, and `occurredAt`.
- Generic network failure is not a child behavioral failure.
- Pending intent never expires silently.
- A sibling/guardian session must not replay another child's queued command.
- Same-command replay must not duplicate completion facts/events.
- Stale conflicts remain explicit and block blind subsequent replay.
- Browser input identity fields are never trusted by the server; ActorContext is still server-resolved.

## Completion gate

E3 is complete only when the latest E3 branch/PR head passes typecheck, lint, formatting, domain/unit/integration tests, production build, browser-bundle guard, and Playwright smoke.
