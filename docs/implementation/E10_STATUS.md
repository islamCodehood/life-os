# E10 — Visual World

## What shipped

The Island MVP renders **world meaning, not gameplay currency**. Home / Path / Bridge / Family Tree / Giving Garden / Library / Harbor / Observatory are SVG scenes whose appearance is derived from immutable semantic world unlocks. The renderer supports the `IMMERSIVE`, `BALANCED`, `FOCUSED` experience modes, and `FULL`, `REDUCED`, `OFF` animation preferences. A `prefers-reduced-motion` media query overrides motion automatically. Every mode includes accessible semantic text; focused mode is deliberately text-first.

**Personal World** shows only a child's own facts. **Family World** aggregates genuinely shared milestones without displaying per-child contributions or sibling rankings. Read APIs enforce server-authenticated tenant and child scoping.

## Canonical interpretation

E10 reads existing validated domain facts with the source event's ID and timestamps. The following semantic milestones are materialized:

| Fact from existing domains | World meaning | Scope |
|---|---|---|
| Child's self-initiated self-responsibility completion | HOME_PATH / INDEPENDENCE | personal |
| Skill practice with uncorrected, positive XP grant | LIBRARY_OPEN / LEARNING | personal |
| Currently approved graduated responsibility | BRIDGE_READY / AUTONOMY | personal |
| Currently achieved personal goal | OBSERVATORY_LIT / GOALS | personal |
| Published child-safe Kindness/Generosity Moment | GIVING_GARDEN / KINDNESS memory | personal |
| A completed genuine family-responsibility assignment | FAMILY_TREE / FAMILY | family |
| Currently achieved shared family goal | FAMILY_TREE / FAMILY | family |
| Published explicitly family-shared Moment | FAMILY_GARDEN / FAMILY memory | family |

**No other activity categories produce XP or money because of the world**. There is no moral score or completion-to-world-experience currency.

This is a deliberate conservative interpretation of the existing E4, E6, E7 and E9 facts. The Harbor art is included but monetary/save progress is not unlocked from E8, because E8 does not yet append the necessary domain events and money must not be faked by the renderer. The theme manifest maps semantics to drawn regions; persisted records never contain themes, graphic coordinates, SVG names, visual brightness, animations or motion preferences.

## Persistence and eventual projection

- Migration: `drizzle/0016_visual_world.sql`; table `world_unlocks` has `family_id`, nullable personal `child_id`, `world_scope`, semantic dimension/milestone, canonical source event and timestamp.
- Unique `family_id + source_event_id + milestone_key` prevents duplicates during simultaneous reads or command retries. Trigger disallows UPDATE/DELETE of unlock history.
- Read-through reconciliation: a GET derives *active* milestones from canonical domain events and joins them to current activity, goal, graduation and Moment states. A missing unlock is inserted once (no external job required), then returned. Materialized historical unlocks are **never blindly treated as authority**; if a Moment is archived, a goal no longer counts, a graduation is reactivated or an XP grant is corrected, the corresponding visual milestone is hidden while its audit history remains retained. This is important to avoid storytelling from stale or private data.
- Only one source is materialized per semantic milestone per scope and child per read. A newly valid source can supersede an archived original; historical entries remain append-only.
- A bounded read-through projection is suitable for the current pilot. For production scaling, move backfill from HTTP GET to the transactional outbox/worker and add pagination. The existing E0–E9 runtime does not yet implement such a worker.

## Motion and offline

- Presentation modes and theme selection never issue a domain command and do not change unlock facts.
- Full: up to three **grouped** recent region animations. Reduced: maximum one gentle fade. Off: none. OS `prefers-reduced-motion` also disables nonessential movement.
- Offline bulk replay projects semantic milestone state on next online read. It never plays a separate animation for every queued completion, and it never invents unconfirmed unlocks.
- Private world data is not added to unscoped IndexedDB snapshots or service-worker caches.

## API / UI

- `GET /api/v1/child/world`: own personal world only.
- `GET /api/v1/children/:childId/world`: guardian-only child world.
- `GET /api/v1/family/world`: family shared world for authenticated family actors.
- Child dashboard: personal island and family island with current saved experience and motion preferences.
- Parent dashboard: aggregated family island, not sibling-comparison statistics.
- Accessibility: SVG title/description, semantic region status list, readable static equivalent, responsive layout, Arabic/English labels and reduced-motion support.

## Boundaries

- **DB migration rehearsal** is not part of the default CI because a configured real PostgreSQL service is needed.
- This is the SVG-first semantic pilot, not an expensive 3D/Rive game. No new third-party libraries were introduced.
- Does not change age, financial, permission or XP policies. E11 weekly reflection remains separate.
