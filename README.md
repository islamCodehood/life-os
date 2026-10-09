# Life OS

Life OS is an offline-capable family PWA designed to help children progressively become more independent.

> The system succeeds when it gradually becomes less necessary.

## Current status

**Epic 0 — Engineering Foundation**, **Epic 1 — Family Identity + Child-Scoped Sessions**, and **E2 — Make Bed pilot slice** are complete. The current implementation target is **E3 — Offline Completion + Replay**, strictly focused on making the existing Make Bed completion durable and replay-safe without adding new task types or reward behavior.

## Start here

- `AGENTS.md`
- `docs/spec/system-design-v0.1-v0.4.md`
- `docs/spec/system-architecture-v1.0-v1.3.md`
- `docs/spec/implementation-spec-v2.0-v2.3.md`
- `docs/implementation/MASTER_IMPLEMENTATION_PROMPT.md`
- `docs/implementation/EPIC_0_PROMPT.md`
- `docs/implementation/EPIC_1_PROMPT.md`
- `docs/implementation/EPIC_3_PROMPT.md`
- `docs/handoff/IMPLEMENTATION_HANDOFF.md`
- `docs/handoff/MAGICPATH_HANDOFF_V3.3.md`

## UI contract

Production UI is consumed from the pinned public `@life-os/design-system` Git dependency. Storybook V3.3 is the exact component/state contract. MagicPath is a composition and flow reference only.

## Local foundation workflow

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Database smoke is opt-in until a local/dev PostgreSQL URL is configured:

```bash
RUN_DB_SMOKE=1 pnpm test:integration
```
