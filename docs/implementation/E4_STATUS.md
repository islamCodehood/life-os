# E4 status — Reminders, Independence, Coverage, Recovery

Branch: `feat/e4-reminders-independence-recovery`

Implemented scope:

- reminder record persistence with explicit:
  - source: SYSTEM / GUARDIAN / CHILD
  - kind
  - scheduled time
  - attempted time
  - delivered time
  - acknowledged time
- idempotent reminder scheduling per activity opportunity
- age-profile reminder defaults for newly assigned Make Bed responsibilities
- child-created reminders remain planning evidence rather than external dependency
- self-initiation is classified from reminders actually delivered before the real completion `occurredAt`
- scheduled/attempted reminders are never treated as delivered automatically
- expired unreported `PENDING` opportunities become `AWAITING_RESOLUTION`, never automatically `MISSED`
- guardian `MarkActivityMissed` and `ExcuseActivity` resolution commands
- E3 offline compatibility: a completion that really occurred inside the opportunity window can still replay from `AWAITING_RESOLUTION`
- transparent Make Bed evidence:
  - consistency
  - completion rate
  - self-initiation rate
  - external reminder dependency
  - average delivered reminders per opportunity
  - on-time rate
  - Data Coverage
- recovery opens only from a confirmed `MISSED`
- recovery latency counts subsequent valid opportunities, not calendar days
- `EXCUSED` and `NOT_APPLICABLE` do not reduce consistency/recovery evidence
- parent insight presentation with explicit low-coverage messaging
- parent unresolved-opportunity controls
- child recovery recognition after return from a confirmed miss
- recovery recognition grants no XP

Persistence:

- `drizzle/0007_activity_reminders.sql`

No XP, money, autonomy, graduation, or Visual World persistence is introduced by E4.

Readiness boundary:

The frozen product specification deliberately does not define a minimum observation count or readiness percentage. E4 therefore exposes evidence and Data Coverage only. It does not create or approve an autonomy/graduation suggestion. Those authority-changing flows remain later epics and guardian-controlled.

Notification boundary:

E4 persists reminder scheduling/evidence semantics. Push/Web Notification delivery, retry/backoff, quiet hours, and scheduler hardening remain E12. A scheduled reminder is never counted as delivered unless a delivery fact is explicitly recorded.

Acceptance coverage:

- unreported does not become Missed
- only a guardian-confirmed miss opens recovery
- recovery latency counts valid opportunities rather than calendar days
- excused opportunities do not reduce consistency
- unresolved data reduces Data Coverage rather than becoming failure
- incomplete coverage prevents any readiness claim
- child-created reminder does not create external dependency
- only delivered external reminders affect self-initiation
- reminder after completion does not affect the completion classification
- interrupted/offline completion remains valid after scheduler transition to Awaiting Resolution
- recovery recognition has no XP behavior
- reminder migration preserves separate attempted/delivered/acknowledged timestamps

Completion gate:

E4 is complete only when the latest branch/PR head passes the full `validate` and Playwright `smoke` jobs.
