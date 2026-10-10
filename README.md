# Life OS

Life OS is an offline-capable family PWA designed to help children progressively become more independent.

> The system succeeds when it gradually becomes less necessary.

## Current status

**Epic 0 — Engineering Foundation**, **Epic 1 — Family Identity + Child-Scoped Sessions**, **E2 — Make Bed pilot slice**, and **E3 — Offline Completion + Replay** are complete. **E4 — Reminders, Independence, Coverage, Recovery** is merged. **E5 — Graduation and Regression Monitoring** was merged from PR #6 with a guardian-controlled graduation review, child self-managed view, and parent monitoring. Automated readiness thresholds remain undefined, so no automatic graduation verdict is made. See `docs/implementation/E5_STATUS.md`. **E6 — Growth & Skill XP** is merged (PR #7); see `docs/implementation/E6_STATUS.md`. **E7 — Goals & Shared Goals** is merged (PR #8); see `docs/implementation/E7_STATUS.md`. **E8 — Jobs & Money** is merged (PR #9); see `docs/implementation/E8_STATUS.md`. **E9 — Moments & Story** is under review in PR #10; see `docs/implementation/E9_STATUS.md`.

## Start here

- `AGENTS.md`
- `docs/spec/system-design-v0.1-v0.4.md`
- `docs/spec/system-architecture-v1.0-v1.3.md`
- `docs/spec/implementation-spec-v2.0-v2.3.md`
- `docs/implementation/MASTER_IMPLEMENTATION_PROMPT.md`
- `docs/implementation/EPIC_0_PROMPT.md`
- `docs/implementation/EPIC_1_PROMPT.md`
- `docs/implementation/EPIC_3_PROMPT.md`
- `docs/implementation/EPIC_4_PROMPT.md`
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
