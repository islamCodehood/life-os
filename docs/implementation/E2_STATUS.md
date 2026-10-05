# E2 status — Make Bed pilot slice

Branch: `feat/e2-make-bed-pilot`

Implemented scope:

- seeded `SELF_MAKE_BED` self-responsibility template
- guardian assignment flow
- daily timezone-aware opportunity materialization
- child Today responsibility card
- child completion command with expected-version conflict protection
- server-side child/sibling authorization
- completion record and `ActivityCompleted` domain event
- parent completion-history view
- internal scheduler materialization endpoint
- no money reward for ordinary self responsibilities
- training-only XP policy preserved without adding XP behavior in this slice
- English/Arabic UI copy for the Make Bed pilot

Persistence:

- `drizzle/0003_activity_templates.sql`
- `drizzle/0004_activities.sql`
- `drizzle/0005_activity_instances.sql`
- `drizzle/0006_completion_and_events.sql`

Acceptance coverage added:

- self-responsibility policy invariants
- values/faith XP prohibition remains intact
- daily opportunity-window calculation
- family-timezone date handling
- idempotent Make Bed assignment
- child self-completion and one completion event
- replay-safe already-completed behavior
- sibling completion concealment
- completion outside the opportunity window denied
- child Today DTO scoped to the active child

Completion gate:

E2 is complete only when the latest branch head passes the full CI `validate` and `smoke` jobs. This slice proves one task end to end; it does not mean `SELF_MAKE_BED` is a separate product subsystem or that the broader generic responsibility/task system is finished.
