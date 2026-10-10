# E7 — Goals & Shared Goals

Branch: `feat/e7-goals-shared-goals`; PR #8 against merged E6.

## User-visible scope
- Personal goals defined by what/why/next step/target and optional target date.
- Child can propose own personal/growth/project goal. Since a persisted autonomy authority module is not yet implemented, **all child-created goals await guardian approval** by default; age changes neither permission nor state.
- Guardian can create personal or family-owned shared goal directly and can approve child proposals.
- Active goal: child can record own progress; family-owned SharedGoal accepts increments from any authenticated child in that family. Parent can record progress too. Shared goal is one collective progress bar, **never sibling contribution rankings**.
- Pause/resume, revise target/date with append-only revision history, achieve only after target, close without a negative 'Failed' label, and reflection after achievement or closure.
- The deadline is a **derived `TARGET_DATE_REACHED` presentation status**, not a destructive transition. It does not prohibit continuing, changing target, or closing.
- Parent sees all family goals. Child can see only own private goals and explicitly shared family goals. Child read history omits contributor identity and individual totals.

## Architecture
- Commands reuse authenticated `/api/v1/commands` and its transactionally idempotent command ID.
- All meaningful updates require an expected Goal version; rows are locked FOR UPDATE; stale writes report 409 rather than last-write-wins.
- Goal progression advances `goals.progress` atomically with append-only `goal_progress_entries`; the history is retained for audit/rebuild.
- Immutable histories: `goal_progress_entries`, `goal_revisions`, `goal_reflections` with database UPDATE/DELETE guards.
- Read APIs: `/api/v1/child/goals`, `/api/v1/children/:childId/goals` (guardian only), `/api/v1/family/shared-goals` (family participants only). No contributor ranking fields.
- PostgreSQL canonical; no XP, money, sibling ranking, automatic age-based autonomy, or expiry punishment.

## Migration
`drizzle/0010_goals.sql` — goals, progress, target revisions and reflections; composite family-scoped FKs, ownership checks and append-only protection.

## Intentional pilot boundaries
- Child offline goal mutations are **not yet** added to E3's `CompleteActivity`-only Dexie outbox. Goals UI explicitly requires connectivity for confirmed commands. Offline goal UX remains pending and should not be misrepresented as synced.
- Persisted autonomy permissions are not in E7; conservative guardian approval is enforced. A later autonomy epic can safely add permission checks and child-proposed revision paths.
- Savings/wallet goals belong to E8; this E7 slice has no financial side effects.
- Parent may close/revise but not rewrite historical goal progress. Nonpunitive corrections/undo of mistaken goal-progress entries require a later explicit audited correction flow.
- Milestone celebration uses current app UI, not an invented visual-world asset.

## Verification
GitHub Actions must pass TS, lint, format, domain/unit/integration tests, build, browser bundle and Playwright smoke. A real configured PostgreSQL smoke/recovery rehearsal remains separate and opt-in.
