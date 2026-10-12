# E11 — Weekly Review

## Product contract
Weekly Review is a low-pressure family conversation, **not a scoring system**. It asks:
What are you proud of? What was difficult? What did you learn? Did you help someone?
What would you like to improve? What is one focus for next week?

A parent can start the family review, read a strictly factual summary, optionally share
their reflections and the reflections their children elected to submit, choose one future
focus, and complete or skip. Children can submit or edit only their *own* responses while
the review is open. No child is required to write a response for a review to complete.

## Scheduling and behavior
- One review per family per seven-day **local** reporting window. The stored window is
  `[week_start,week_end)`; `review_on` is the family's review day and equals week_end.
- Based on `families.weekly_review_day` (JS weekday 0=Sun–6=Sat) and the family's IANA timezone.
  Existing families with null use a **Friday** pilot fallback until review-day configuration
  is exposed to families in settings/onboarding.
- An existing authenticated internal scheduler tick (`/api/v1/internal/scheduler/materialize-activities`)
  now also idempotently materializes the due week for all families, reusing the signed
  `INTERNAL_SCHEDULER_SECRET`. Guardians may also explicitly start the current review.
- A previous unfinished week becomes `ABANDONED` at the next scheduled week; previous
  responses remain in the database, but there are no XP, money, lost streaks, child failures
  or punishment effects. Explicit `SKIPPED` is also neutral.
- End states are COMPLETED, SKIPPED or ABANDONED; a submitted family next focus is required
  only for COMPLETED. No automatic parent judgement, sentiment/personality score or AI.

## Persistence and concurrency
- `drizzle/0017_weekly_reviews.sql` creates `weekly_reviews` and `weekly_review_entries`.
  The frozen spec calls the migration `0015_weekly_reviews.sql`, but E10 already merged a
  `0016_visual_world.sql` migration. We intentionally use **0017** to preserve
  ascending migration order; there is no behavior deviation.
- Unique (family,week_start) prevents duplicate weekly reviews; unique (review_id,author_key,prompt)
  preserves single editable response per author/prompt.
- The server constructs `author_key` from the authenticated actor. Composite family+child and
  family+guardian FKs plus a DB owner constraint prevent forged authorship.
- Commands `StartWeeklyReview`, `SaveWeeklyReviewEntry`, `CompleteWeeklyReview`,
  `SkipWeeklyReview` go through the existing idempotent, transactional server command envelope.
- Guardian status transitions are guarded by expected review version and locked rows. Each
  individual reflection uses an expected entry version (0 on initial creation). A PostgreSQL
  trigger rejects new/updated entries after the review is closed.
- Saved child reflections are never included in another child's result or browser cache. A
  guardian may read all child's submitted reflections; there is no guardian mutation endpoint
  to rewrite child-authored text.
- No unnecessary reflection text in application logs, generic domain events, analytics, XP or
  money history.

## Factual summary
- Count actual completed self/family responsibilities and growth practice during local days
  of the reporting week (never equate no reported activity with a failure).
- Count real goal-achieved transition events and still-published Moments. All data is
  filtered by tenant; child view includes only its own activity/goal/personal-Moment facts
  plus explicitly family-shared Moment count. Guardians get a family-level summary.
- No public comparison, global score, inferred intention, virtue judgement or fake records.
- Historical summary queries are bounded to the week's local calendar window. For the MVP
  these are indexed counts of canonical records computed on read, not a separate potentially
  stale analytics projection.

## UI / APIs
- Child dashboard: age-adaptive Explorer illustrated prompt, Builder story-card prompt, or
  older child reflection field. English and Arabic, own answers only, safe read-only state
  after closure.
- Guardian dashboard: current review, family facts, submitted child responses, guardian
  prompts, focus, complete and skip.
- `GET /api/v1/family/weekly-review` returns an actor-scoped DTO (authenticated, no-store).
- Writes require an active authenticated session and network connectivity. Text is not
  silently claimed to be saved offline; offline draft persistence is deliberately avoided
  because these are sensitive child reflections.

## Verification and operational boundaries
- CI typecheck, lint, format, unit/domain tests, production build, Playwright smoke expected.
- Tests cover repeat scheduler ticks, local week boundary/year rollover, actor privacy,
  optimistic revisions, child/guardian authorization, completion, skip, abandonment, and DB constraints.
- A configured PostgreSQL migration and authenticated family UAT test is still needed before
  claiming production readiness. Existing generic Playwright shell smoke is not a full
  signed-in, populated-database acceptance test.
- Configuring `weeklyReviewDay` from an onboarding/settings screen remains a separate
  profile-preferences UX task; its canonical data field and timezone-aware schedule are used.
