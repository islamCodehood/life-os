# E13 — Pilot Hardening and Production Readiness

## What is now enforced by code/CI
- A **disposable PostgreSQL 16 database** is created in GitHub CI; the entire ordered Drizzle migration chain is applied and applied again to prove forward-only idempotent migration behavior.
- Real SQL smoke verifies critical core tables, duplicate per-family review rejection, a forged cross-family reflection owner being rejected, reflection freeze after close, source/intent persistence and a visible locked outbox row being skipped by a competing worker. It leaves fixtures inside the disposable DB, which CI destroys.
- Additional HTTP security headers: MIME nosniff, denied framing, strict referrer, restricted Permissions Policy, same-origin opener, base CSP and HTTPS HSTS in production.
- Signed internal health endpoint `GET /api/v1/internal/health`: database presence, schema coverage, scheduler last success and outbox pending/failed/processing/age. Public health remains minimal.
- Family-scoped guardian-only JSON export, including child profiles, task history, skill XP, goal and money ledgers, private Moment audit and weekly reflections; no PIN hashes, device secrets, push subscription URLs/auth keys or session tokens.
- Encryption-at-stream backup tool, fail-closed local disposable restore utility, private export/backups excluded from Git.
- Detailed UAT acceptance matrix `docs/uat/E13_ACCEPTANCE_MATRIX.md`, with evidence instructions and human signoff gates.

## Deployment procedure — explicit gates

1. Review and merge E12 PR before E13. No unreviewed deployment from a feature branch.
2. Set **environment-specific** runtime/migration database URLs, Supabase auth configuration, `CHILD_SESSION_HASH_SECRET`, internal scheduler secret, VAPID public/private/subject settings. Never expose private VAPID, DB, service-role or session material through `NEXT_PUBLIC_*` or logs.
3. In **development cloud**, take an encrypted backup before schema changes, apply ordered migrations, verify internal health and run signed scheduler/worker, then run the full UAT matrix with test families and fake money values.
4. For a true disaster-recovery drill, use an **isolated local** PostgreSQL restore destination distinct from the runtime and migration databases. The restore script **refuses** non-local targets and requires explicit human confirmation. Validate family/child references, money ledger balancing, idempotency records, history, device/access continuity and private-data minimization.
5. Collect actual iOS Home Screen PWA and Android/browser push evidence. Verify explicit consent, opt-out, DST quiet hours, permission denial and missed push neutrality.
6. Assess production compliance: signed scheduling cadence and alarms, retention and data-export policy, incident contacts, secrets rotation, backup generations and RPO/RTO. Configure monitoring on outbox age/failed count and scheduler recency.
7. Run authenticated mobile/offline chaos and keyboard/screen reader acceptance. Fix P0 issues. Obtain guardian pilot signoff and **then** promote only reviewed SHA.

### Encrypted backup

Requires installed `pg_dump` and the `age` CLI, and an outside-repository encrypted destination:

```bash
export DATABASE_URL_MIGRATION='postgresql://...'
export AGE_RECIPIENT='age1...'
export BACKUP_FILE='/secure-external-location/life-os-2026-10-12.dump.age'
node scripts/ops/backup-encrypted.mjs
```

No plaintext dump is written by the script. Private DB URLs are passed through an environment variable, not shell CLI arguments. Protect shell histories and process environments at the host level; maintain multiple external backup generations.

### Non-production restore rehearsal

Install `pg_restore` and `age`. The target must be a disposable **localhost** database, *never* the configured runtime or migration target:

```bash
export BACKUP_FILE='/secure-external-location/life-os-2026-10-12.dump.age'
export AGE_IDENTITY_FILE='/secure/age-backup-identity'
export RESTORE_TARGET_DATABASE_URL='postgresql://...@127.0.0.1:5432/lifeos_restore'
export CONFIRM_NON_PRODUCTION_RESTORE='YES_RESTORE_TO_DISPOSABLE_LOCAL_DATABASE'
node scripts/ops/restore-disposable.mjs
```

Manual evidence: schema versions, family and child mappings, total debit/credit by transaction,
exactly-once command history, archived Moment revisions and review entries must be checked after restoration.

### Internal operational health

`GET /api/v1/health` exposes only public availability. `GET /api/v1/internal/health` requires
`Authorization: Bearer <INTERNAL_SCHEDULER_SECRET>`; returned queue/backlog and scheduler timestamps must
stay in privileged monitoring. Set alert thresholds after observing a pilot baseline.

## Security gaps that still block general availability

- CSP currently includes Next's `unsafe-inline` bootstrap/style allowance; the next security pass should implement **per-response nonces** and remove inline exceptions. Do **not** describe the current CSP as strict.
- A verified cross-family delete/erasure cascade procedure is not yet implemented. Family data export is **not** an automatic right-to-erasure pipeline. Requests for removal require a reviewed data-retention/deletion plan with backups and legal requirements.
- IP/network-level brute-force throttling and anti-automation controls need configured infrastructure validation even where the PIN model has persisted attempt limits.
- The existing CI browser smoke covers unauthenticated shells; it does not replace an authenticated populated-database financial/offline walk-through or hardware-specific PWA and push acceptance.
- A real encrypted restore drill in an approved non-prod environment has not been run by these scripts in CI; installation of `age`, key custody and an external backup destination are operator responsibilities.
- Financial history correction, job terms and child-autonomy/graduation decisions require focused signed-in UAT evidence before production use.
- Guardian oversight/consent model for children's push opt-in and age-appropriate data handling must be reviewed before enabling child push for a general-audience deployment.

**Release verdict:** E13 can make code and CI verification more credible; it cannot mark an actual deployment **UAT-approved** without evidence from a configured environment and real devices.
