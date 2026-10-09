# E3 status — Offline Make Bed Completion + Replay

Branch: `feat/e3-offline-completion-replay`

Implemented scope:

- actor/device-scoped Dexie `LifeOSLocal` schema with the frozen offline table groups
- durable `commandOutbox` for `CompleteActivity`
- atomic actor-scoped `clientSequence` allocation with command persistence
- `executeCommand()` facade that persists before signaling sync
- Make Bed child UI no longer posts directly to `/api/v1/commands`
- optimistic completed presentation with design-system pending/offline sync states
- hydration of retained local Make Bed completions after client remount
- replay through the existing idempotent command API using the original:
  - `commandId`
  - `occurredAt`
  - payload
  - expected versions
  - client sequence
- interrupted `SYNCING` recovery back to `PENDING`
- transient network/server retry without deleting the child intent
- typed `STALE_VERSION` / `RESOURCE_STATE_CHANGED` conflict persistence
- conflict blocking to prevent blind replay of later actor commands
- retained `FAILED` state for deterministic server rejection
- child/sibling local queue isolation on shared devices
- active-actor lifecycle that aborts/suspends old child replay when profile scope changes
- retry scheduling only while the same child actor is active and online
- English/Arabic explanatory copy for local conflict/failure states

No PostgreSQL migration is required for E3. The server-side processed-command idempotency and activity transaction added by earlier slices are reused.

Test coverage:

- intent exists in the store before sync is signaled
- actor-scoped sequence allocation
- original real-world `occurredAt` survives replay
- sibling queues remain isolated
- accepted replay removes the local command
- transient failure retains the exact same command for retry
- stale-version conflict is persisted and blocks later replay
- only the active actor queue syncs
- an interrupted `SYNCING` record is recovered and replayed
- Dexie declares the frozen local-storage table groups
- pre-existing E2 server idempotency coverage still verifies repeated completion does not duplicate canonical effects

Explicitly out of scope:

- additional task/activity types
- generic task builder
- offline guardian setup commands
- XP, money, reminders, recovery, graduation, or Visual World progression
- broad offline caching of guardian/private screens
- inventing a domain-level conflict resolution decision
- service-worker caching of POST commands

Completion gate:

E3 is complete only when the latest E3 branch/PR head passes the full `validate` and Playwright `smoke` jobs. PostgreSQL remains canonical; IndexedDB is durable intent, not a second source of business truth.
