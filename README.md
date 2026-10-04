# Life OS

Life OS is an offline-capable family PWA designed to help children progressively become more independent.

> The system succeeds when it gradually becomes less necessary.

## Current status

The repository is in **Epic 0 — Engineering Foundation**. No Life OS business features should be implemented before the E0 gates are green.

## Start here

- `AGENTS.md`
- `docs/spec/system-design-v0.1-v0.4.md`
- `docs/spec/system-architecture-v1.0-v1.3.md`
- `docs/spec/implementation-spec-v2.0-v2.3.md`
- `docs/implementation/MASTER_IMPLEMENTATION_PROMPT.md`
- `docs/implementation/EPIC_0_PROMPT.md`
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
