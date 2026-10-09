# Offline boundary

E3 introduces the first production offline domain-mutation path for the existing Make Bed completion.

## Canonical ownership

- PostgreSQL remains canonical business truth.
- Dexie / IndexedDB stores durable local command intent and actor-scoped local records.
- TanStack Query remains an in-memory server-state cache.
- The service worker may cache shell/static resources but must never cache POST domain commands.

## E3 command flow

```text
child action
  -> executeCommand()
  -> Dexie commandOutbox transaction
  -> optimistic completed + pending/offline presentation
  -> SyncCoordinator
  -> POST /api/v1/commands
  -> server ActorContext + idempotency + domain transaction
  -> accepted / retryable / conflict / retained failure
```

The first supported offline mutation is `CompleteActivity` for the existing `SELF_MAKE_BED` pilot. Other commands remain outside E3 scope.

## Privacy and actor scope

Durable command records are scoped by child + family + trusted device. Replay is active only while that child actor is active in the UI. Switching profile aborts the old actor's replay loop.

## Conflict rule

Typed stale conflicts are retained in the local `conflicts` table and stop blind replay for that actor. E3 does not invent a new domain-level resolution decision.
