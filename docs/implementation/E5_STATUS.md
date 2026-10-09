# E5 — Graduation and regression monitoring

Branch: `feat/e5-graduation-monitoring` — PR #6 (draft until CI is green).

## Scope: Make Bed only

- Graduation review is **guardian-initiated**. E4 does not define or validate readiness thresholds, so E5 must not manufacture an automatic readiness recommendation.
- The review stores a transparent `graduation_evidence_snapshots` record based on E4 metrics.
- A guardian can approve, decline or snooze. Only `ApproveGraduation` changes the assignment to `GRADUATED` (with expected-version protection).
- Child Today's daily responsibility list excludes graduated assignments, without deleting history.
- Child's `I Manage These Myself` is a positive read model of the same canonical graduation record.
- Parent sees graduated responsibilities, monitoring status and observations.
- The monitoring interval is configurable on approval (1–90 days, with a **pilot default of 14 days**). This is a scheduling default, not scientific readiness evidence.
- Observations: `STABLE`, `SOMETIMES_NEEDS_HELP`, `NEEDS_REGULAR_SUPPORT`.
- Overdue monitoring means **missing check-in**, never inferred regression.
- One concerning observation opens WATCH; **two consecutive** `NEEDS_REGULAR_SUPPORT` observations offer a reactivation review, but do not change the assignment.
- Guardian approval reactivates the same assignment from the next local calendar day. History and prior graduation cycle remain; no task duplication.
- Mutations use existing server-resolved actor, transactional idempotent commands, family-scoped PostgreSQL reads/writes and append-only domain events.
- No XP, money, sibling comparison, punishment or auto-reversal.

## Data

- `drizzle/0008_graduation.sql`
- `graduation_evidence_snapshots`
- `graduation_suggestions` (guardian-review graduation and system-generated reactivation-review)
- `graduation_records`
- `graduation_observations`
- Assignment status extended with `GRADUATED`.

## Validation

Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:domain && pnpm test:unit && pnpm test:integration && pnpm build && pnpm check:browser-bundle` plus Playwright smoke in CI.

## Limits / further product validation

- Automated graduation *readiness* suggestions remain **disabled** until a transparent observation window, data coverage, freshness and threshold policy is reviewed; guardian-requested review is not an algorithmic endorsement.
- The two-consecutive-regular-support rule and 14-day monitoring default are provisional pilot policies to validate in family testing.
- Parent check-ins are stored; push delivery, reminder retries/quiet hours and background monitoring notification orchestration remain the notifications epic.
- Celebratory copy / self-managed list are wired; full semantic Visual World graduation scene and animation require Storybook theme contract integration and should not be fabricated by the app.
- Offline *guardian authority-changing* commands remain server-only; child offline completion is still E3/E4.
- A stale queued child completion after graduation is explicitly rejected as a state change rather than used to silently undo guardian graduation. This race needs a separate reconciliation UX decision.
