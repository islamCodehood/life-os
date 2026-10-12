# Life OS — UAT Acceptance Matrix and Release Evidence

**Status:** The repository now contains E0–E12 pilot flows. This is an executable acceptance plan, **not** a declaration that a family-production deployment has passed.

## Evidence record

For each scenario, record `date/time (Africa/Cairo)`, tested commit SHA, environment, actual browser/device/OS,
actor/family test fixture, pass/fail/blocked, issue or screenshot link and tester initials. Never paste child PINs, session cookies,
push subscription keys, private reflections, financial account numbers or secret values in issue screenshots/logs.

### 1. Family, identity and shared device (P0)
- [ ] Owner creates family in Cairo timezone; Arabic and English switch preserves family.
- [ ] Owner creates two children (Explorer and Builder) and one guardian.
- [ ] Child A signs in with household device and own PIN; cannot access Child B wallet, private Moments, jobs, XP, story, personal world or weekly reflection by guessing API URLs.
- [ ] Child mode cannot access parent-only actions, family export, money correction or review completion; each returns safe 401/403/404.
- [ ] Parent unlock expires and switching to child mode removes guardian privileges; child cannot re-enter parent mode via a simple route refresh.
- [ ] Wrong PIN repeated beyond configured threshold is throttled, and a successful PIN reset invalidates old sessions across devices.
- [ ] Revoking a household device revokes its child sessions; only explicit re-enrollment restores access.
- [ ] Logs contain no raw PIN, cookie, access token, VAPID private key, Moment/reflection text or full wallet history.

### 2. Responsibilities, independence, recovery (P0)
- [ ] Assign Make Bed and a growth practice to Child A; Child B sees neither private assignment.
- [ ] Generate daily opportunity once through signed scheduler; send the same tick twice, verify only one row for same assignment/target.
- [ ] Child completes once with no delivered reminder: self-initiated evidence accurate. Two tabs repeat command ID: one recorded completion and XP only when allowed.
- [ ] Completion after a genuinely acknowledged/delivered guardian reminder uses external-reminder evidence; a rejected push does **not** count as delivered.
- [ ] Force device offline, queue completion, reload, reconnect and verify durable replay and one semantic completion; stale version surfaces a non-destructive conflict.
- [ ] Missed opportunity is unresolved, never presumed failed; guardian can resolve as MISSED/EXCUSED/NOT_APPLICABLE without corruption.
- [ ] Recovery and low data coverage display honestly with no retroactive discipline or moral scores.

### 3. Skills, goals, graduation (P0)
- [ ] Reading/Chess practice creates policy-defined skill XP; self-responsibility/faith/values do not create arbitrary XP or money.
- [ ] XP correction writes a compensating ledger entry; child totals and world effects reconcile, no silent deletion.
- [ ] Child and family goals: create, approve where needed, progress, revise, pause, achieve, close, reflect; stale edit rejected.
- [ ] Graduation requires guardian evidence review; no scheduled job can self-approve it.
- [ ] Graduated routine leaves daily gamified flow but remains visible to parent and in child's independent-responsibilities view.
- [ ] Monitoring overdue causes a guardian prompt, not an accusation; observations and reactivation remain guardian-controlled.

### 4. Jobs and money (P0 — real DB mandatory)
- [ ] Guardian publishes paid job terms; child accepts current version, completes work, guardian approves, credit occurs once.
- [ ] Rejected/changed job terms do not cause unauthorized money credit or acceptance under stale terms.
- [ ] Give, Save, Spend, transfers and saving goals preserve balanced ledger postings in integer minor currency units.
- [ ] Apply corrected transaction and inspect immutable compensating history; repeat command cannot create double credit.
- [ ] Cross-family wallet reads/writes rejected; different child in same family cannot transfer or export sibling's wallet via child API.
- [ ] Failure mid-transaction rolls back money and idempotency record together.

### 5. Moments, Visual World and Weekly Review (P1)
- [ ] Guardian creates Child A private, guardian-private and family-shared Moments; Child B sees only truly shared Moments.
- [ ] Update/archive creates complete guardian-auditable version history; archived Moment disappears from child story/world without deleting audit.
- [ ] Explorer/Builder/Navigator layouts convey the same semantic milestones; reduced/Off/OS reduced-motion make animations disappear.
- [ ] World refresh/replay does not duplicate unlocks or trigger dozens of celebrations after offline sync; no sibling ranking.
- [ ] Scheduler creates one family review in local week and marks expired OPEN weeks ABANDONED without penalties.
- [ ] Children answer their own six optional prompts; Child A cannot see/overwrite Child B responses.
- [ ] Guardian sees fact-only summary, records their own response and focus or skips; closed review is read-only.
- [ ] Arabic prompts, dates, numbers and RTL alignment read naturally without mixed-direction leakage.

### 6. Notifications and device support (P1, real device mandatory)
- [ ] No push without explicit actor opt-in, browser permission and configured VAPID keys.
- [ ] iOS eligible Home Screen PWA, Android Chrome installed PWA and a desktop browser each tested for subscribe, receive, click, disable and re-enable.
- [ ] Quiet hours in Africa/Cairo suppress push, including across midnight and DST boundary; subscription remains owner-scoped.
- [ ] Duplicate cron tick and concurrent worker produce one intent and one claimed work item; retry/backoff never changes domain truth.
- [ ] Invalid, expired or rejected push provider response does not mark a reminder DELIVERED or a child INATTENTIVE.
- [ ] Child and guardian notification clicks deep-link only to authorized local app routes, even when a family switches profiles.
- [ ] Mobile denied permission / offline / browser without Push retains usable tasks and family content.

### 7. Reliability, accessibility and operations (P0 before pilot release)
- [ ] CI typecheck/lint/format/domain/unit/integration/build/browser bundle/Playwright is green on exact promotion SHA.
- [ ] Disposable Postgres CI migration applies all migrations twice and verifies family/child FK, closed reflections and concurrent queue-lock behavior.
- [ ] New clean development cloud database migrated; indexes, row counts and business constraints verified.
- [ ] Encrypted logical backup created **outside primary DB**, multiple generations retained; restore into disposable non-production succeeds.
- [ ] Restore validates family/child mappings, financial balances, idempotency records, account continuity, Moment and review histories.
- [ ] Production HSTS/HTTPS, CSP, headers, secrets, privileged account limits, logging/redaction and scheduler signature verified.
- [ ] Keyboard-only / screen reader navigation through login, task completion, wallet, review, notifications; sufficient contrast and touch target sizes.
- [ ] Offline chaos and multi-tab retry tests pass on actual mobile/network throttling. No raw child text leaks into service-worker caches.
- [ ] Performance on representative low-end Android and laptop documented (LCP, interaction latency, memory and payload size).
- [ ] Family-scoped data export downloads only on authenticated guardian session; no PIN/token/subscription secrets.
- [ ] Public /api/v1/health reveals no private DB metrics; signed internal health shows scheduler recency and outbox backlog.
- [ ] Release rollback, forward-only migration plan, incident owner, restoration point objective (RPO) and restoration time objective (RTO) agreed.

## Gates / ownership

**Automated candidates:** Migration chain, duplicate review/locked outbox/tenant FK, basic unauthenticated browser shell, unit policy tests, architecture, static security headers.

**Human or deployment-required:** PIN and role flow on a populated family, real money ledger integration, VAPID delivery on actual mobile, device installation, encrypted restore into separate environment, screen reader accessibility, production-grade backup automation, full CSP nonce policy.

**Release decision:** Do not represent the app as UAT-approved or production-ready until every P0 item is verified with evidence and all P1 issues are dispositioned. A green compile/build is *not* sufficient.
