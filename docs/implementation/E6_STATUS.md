# E6 — Growth and skill-specific XP

Branch: `feat/e6-growth-skill-xp`, PR #7.

## Vertical slice
Guardian assigns daily Reading or Chess practice. Child completes it using the same offline-durable `CompleteActivity` queue as Make Bed. On server acceptance, the *same database transaction* records the canonical completion event and, only when the frozen growth policy permits, one append-only XP grant.

### Rules
- `GROWTH_READING` → Reading; `GROWTH_CHESS_PRACTICE` → Chess.
- Server-controlled pilot value: 10 XP per valid practice opportunity.
- Milestone display: 50, 100, 250 XP per skill, **not** an overall child score. These are experimental starter defaults.
- Source event UUID unique in `xp_ledger`. Domain completion row unique per activity instance; processed command envelope idempotent.
- PostgreSQL transaction-scoped advisory lock serializes assignment of one template to one child, preventing concurrent guardian commands from creating duplicate daily opportunities.
- Reactivated/missed/excused Make Bed, recovery, ordinary self/family responsibilities, faith and values do not receive skill XP.
- Skill balance is rebuilt from `xp_ledger`; no editable balance columns or XP-to-money exchange.
- Guardian can correct a *mistaken* XP grant using `CorrectXpGrant` with a reason. Compensation appends `CORRECTION` equal to the negative original amount, with a unique `correction_of` reference and audit event.
- No punishment code path, negative manual grant, direct client XP amount or money conversion.

## Files
- `drizzle/0009_growth_xp.sql` — seeded growth templates; append-only XP ledger and constraints.
- `src/domain/growth/skill-xp.ts` — eligibility, skill mappings, progression/milestones.
- `src/application/growth/xp-repository.ts` / `src/infrastructure/growth/postgres-xp-repository.ts`.
- `src/application/activity/activity-service.ts` — growth assignment, ledger award inside completion transaction, guardian corrections, read projections.
- `src/application/growth/e6-command-schema.ts` — bounded guardian-only growth setup and correction contracts.
- Parent/child growth UIs and English/Arabic messages.

## Validation
CI must pass typecheck, lint, format, domain/unit/integration tests, production build, browser bundle guard and Playwright smoke before merge. `RUN_DB_SMOKE=1` requires a configured PostgreSQL integration database.

## Boundaries
- MVP uses only Reading and Chess samples; no unrestricted growth activity builder yet.
- Award authority remains the server. Offline UI marks a pending completion but does not predict XP.
- Milestone presentation is a simple progress list. Branded Visual World/skill trees belong to later epic, using the design system.
- No sibling leaderboard, money ledger, redemption/exchange, generic XP payouts, or behavior/morality score.
- Child undo / correction of the underlying completion was outside this E6 slice; `CorrectXpGrant` corrects the grant only, with audit trace.
