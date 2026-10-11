# E9 — Moments & Story

## Scope

**Moments:** guardian records published child-safe, guardian-private or explicitly family-shared memories, with a title, description, occurrence time and up to five optional value tags (Kindness, Honesty, Generosity, Courage, Patience, Perseverance, Family, Initiative). Child safety is enforced by server-side actor scoping, not UI-only filtering.

**Audit:** guardian can update or archive published Moments. The `moments` row is a versioned projection; each change creates an append-only `moment_revisions` before/after snapshot with author, version and reason. `moment_tags` is append-only and versioned, including old values. Archived Moments disappear from children's active Story but remain visible to guardians and in their history.

**Story:** `composeStory` is pure, deterministic and translation-key-driven. Its full beat vocabulary includes NEW_BEGINNING, PROGRESS, MILESTONE, RECOVERY, GRADUATION, FAMILY_CONTRIBUTION, KINDNESS_MOMENT, GOAL_ACHIEVED. E9 materializes Moment beats; the composer accepts canonical non-Moment beats for future goal/independence/world integrations. The resulting timeline contains semantic cues and adapts presentation to the effective age/visualization profile: illustrated Explorer, story-card Builder, timeline-focused older child. This is not generative AI and does not assert moral judgments.

**UI:** English/Arabic parent Moment creator/editor with privacy and tags, correction/archive reasons, parent-auditable revision snapshots; child personal/family timelines with expressive semantic cues. No moral points, XP, money, sibling contribution scores, or automated reward conversions.

## Security

- Family ownership enforced by composite family-scoped FKs on child references, tags and revisions, and by tenant-scoped queries.
- Child API reads only published own CHILD_SAFE Moments and explicitly FAMILY_SHARED Moments from that family; never archived, GUARDIAN_PRIVATE or sibling's personal Moments.
- Family API exposes only shared records to the respective authenticated actor; it never exposes unrelated child stories.
- The private revision endpoint requires an authenticated guardian and returns sensitive history with no-store.
- Generic domain events carry only moment ID/version, no raw child text, tags, or personal reflection.
- Client content renders as escaped React text (no HTML injection).

## Pilot permission boundary

The authoritative rules require a child to be **permitted** before recording/publishing values Moments; persisted child Moments autonomy grants have not been implemented. E9 therefore conservatively restricts **published Moment creation/edit/archive to guardians**. Children can view their own safe memories and family memories; age alone never unlocks a publishing permission. Documented instead of silently inferring a permission.

## Persistence / API

- Migration `drizzle/0013_moments.sql` (the canonical frozen name; journal index follows currently merged `0011_jobs_money.sql`), Drizzle schema, repository, domain and application service.
- Mutation commands: `RecordMoment`, `UpdateMoment`, `ArchiveMoment` through existing transactional, idempotent `/api/v1/commands` handler with required expected-version checks for edits/archives.
- Reads: `GET /api/v1/child/story`, `GET /api/v1/children/:childId/moments` (guardian), `GET /api/v1/family/moments` (family-shared), `GET /api/v1/moments/:momentId/history` (guardian).
- Existing PostgreSQL canonical; no local/offline Moment mutation queue is introduced. Internet is required to confirm writes. No private Moment text is saved in additional Dexie snapshots.

## Verification

CI is required to pass typecheck, lint, format, domain/unit/integration tests, browser bundle, production build and Playwright smoke on the final head. Real configured-PostgreSQL migration/recovery rehearsal remains a separate infrastructure check and is not claimed by the standard CI suite.

## Follow-on boundaries

- E10 owns Visual World authored assets/unlocks; E9 records semantic cues, but does not generate a new visual-world game engine.
- Child authoring may be enabled later only when persisted authorized Moment-autonomy rights are implemented.
- E11 owns the weekly review and parent-child structured reflection.
