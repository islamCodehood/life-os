# Epic 4 Prompt — Reminders, Independence, Coverage, Recovery

Implement E4 on top of merged E3. Keep the slice focused on interpreting the existing responsibility history: reminder evidence, independence signals, uncertainty/data coverage, and recovery after confirmed misses.

## Goal

Make the existing Make Bed responsibility answer these questions truthfully:

- Was completion self-initiated or externally prompted?
- How consistent is the known history?
- How dependent is the child on external reminders?
- How much of the expected history is actually known?
- After a confirmed miss, how many valid opportunities did it take to return?

The system must explain evidence without turning it into a global child score or making an autonomy/graduation decision.

## In scope

- reminder records with explicit source, kind, schedule, attempted, delivered, acknowledged timestamps
- source support for system/app, guardian, and child-created reminders
- age-profile reminder defaults for newly assigned Make Bed responsibilities
- reminder scheduling records when activity instances are materialized
- no notification delivery implementation yet
- completion self-initiation classification using reminders delivered before the real `occurredAt`
- child-created reminders treated as planning evidence, not external dependency
- expired `PENDING` opportunities transition to `AWAITING_RESOLUTION`, never directly to `MISSED`
- guardian-confirmed `MarkActivityMissed`
- guardian `ExcuseActivity`
- late/offline completion from `AWAITING_RESOLUTION` when the real `occurredAt` was inside the original opportunity window
- consistency, completion, self-initiation, reminder dependency, average-reminder, on-time, and Data Coverage calculations
- recovery latency in valid opportunities, not calendar days
- excused/not-applicable opportunities excluded from consistency/recovery denominators
- parent Make Bed insight card
- child recovery recognition
- tests covering all E4 acceptance criteria

## Out of scope

- autonomy state changes
- autonomy/graduation suggestions or decisions
- exact readiness/graduation thresholds not frozen in the product spec
- XP grants or recovery XP
- new task types
- push/Web Notification delivery
- reminder escalation/quiet-hours hardening
- Visual World unlocks
- graduation/regression monitoring

## Metric semantics

Use transparent signals, never a composite responsibility/personality score.

- applicable ended opportunities: `COMPLETED | MISSED | AWAITING_RESOLUTION`
- resolved applicable opportunities: `COMPLETED | MISSED`
- consistency: completed / resolved applicable opportunities
- completion rate: completed / applicable ended opportunities
- Data Coverage: resolved applicable / applicable ended opportunities
- self-initiation rate: child self-initiated completions / applicable ended opportunities
- reminder dependency: applicable opportunities completed after an external delivered reminder / applicable ended opportunities
- average reminders/opportunity: delivered reminders / applicable ended opportunities
- on-time rate: on-time completions / completions

`EXCUSED` and `NOT_APPLICABLE` never reduce consistency or recovery evidence. `AWAITING_RESOLUTION` is uncertainty, not a miss, and therefore affects Data Coverage without becoming a confirmed failure.

## Readiness boundary

E4 may expose whether recent Data Coverage is complete/partial, but it must not invent the unspecified minimum observation count or autonomy/graduation percentage threshold. E5 remains responsible for explainable suggestions and guardian decisions.

## Recovery

Only `MISSED` opens recovery.

Recovery latency is the number of subsequent valid applicable opportunities needed to reach a `COMPLETED` opportunity. Excused/not-applicable opportunities are skipped. A completion after the most recent confirmed miss receives recovery recognition with no XP bonus.

## Offline compatibility

An activity can move `PENDING -> AWAITING_RESOLUTION` after its window ends while an offline completion is still queued. If replay later proves the child actually completed inside the original window, allow `AWAITING_RESOLUTION -> COMPLETED`. Do not reject solely because the scheduler advanced the instance version.

## Completion gate

E4 is complete only when the latest E4 branch/PR head passes typecheck, lint, formatting, domain/unit/integration tests, production build, browser-bundle guard, and Playwright smoke.
