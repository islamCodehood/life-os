# E12 — Notifications and Scheduler Hardening

## Delivered
- Opt-in Web Push per authenticated guardian/child actor, up to three linked endpoints, HTTPS provider-host allowlist, public-key browser subscription and VAPID-signed encrypted payload through `web-push`.
- `notification_preferences`: disabled by default; explicit start/end quiet-hours clocks, evaluated in the IANA timezone belonging to the family. Equal start/end is a full-day silent preference.
- Family-isolated subscriptions; no endpoint can be rebound to another actor until unsubscribed. Revoked endpoints (provider 404/410) are deleted.
- `notification_intents` unique per family+actor+source and `outbox_messages` unique per intent. Scheduling both in one SQL transaction prevents partial queue inserts. Tick obtains unique 5-minute bucket; identical scheduler double-fire does not repeat whole work.
- Claim jobs atomically with `SELECT ... FOR UPDATE SKIP LOCKED`, processed under short lock leases, max five attempts and exponential bounded backoff. Separate signed worker endpoint enables independent invocation.
- Intent sources: scheduled self-responsibility reminders for pending assigned instances, overdue approved graduation monitoring prompts, and existing guardian review suggestions. E12 **never auto-graduates**, **auto-reactivates**, assigns new XP/money, or infers moral failure.
- Web Push payload is deliberately generic; sensitive child-specific history is never sent. Notification clicks navigate to allowlisted local child/parent screens; the server always reauthorizes the current actor.
- Arabic and English opt-in UI and payload, no private notification content in logs.

## Important delivery semantics
**Push-service acceptance is NOT evidence of delivery/read/acknowledgement.** A failed or rejected push does not change the activity, streak, money, XP, reminder `delivered_at`, reminder counts, or independence metrics. The worker *does not* write `delivered_at` on HTTP 201/202. No unsupported assertion that the child ignored a reminder is made.
 
Simultaneous workers cannot claim the same outbox row; under network uncertainty, a provider may accept a message before the worker process crashes, so *strict external exactly-once receipt* is not feasible without provider-side dedupe. Browser `tag` groups notifications to limit duplicates. The app guarantees idempotent **domain and intent effects**, not magical exactly-once physical push delivery.

## Operations
- Configure `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `INTERNAL_SCHEDULER_SECRET`; keep the private key server-only.
- Existing signed `POST /api/v1/internal/scheduler/materialize-activities` also processes reminder/suggestion intents and up to ten outbox jobs per invocation.
- `POST /api/v1/internal/scheduler/process-outbox` runs the worker independently under the same signed secret.
- `GET|PUT /api/v1/notifications` manages current actor preferences.
- `POST|DELETE /api/v1/notifications/subscription` manages current actor's browser device.
- Push requires notification permission, HTTPS (except localhost), browser support; iOS/iPadOS Web Push requires an eligible installed Home Screen PWA. Unsupported devices retain all domain functionality.
- Reminder window limited to 75 minutes from scheduled time; quiet-hour or opt-out suppression is a neutral notification decision, not a child completion penalty.
- E13 adds deeper observability, migration gates and security/UAT checks; configured iOS/Android real-device push tests are still required.

## Remaining E12 limitations
- There is no verified app-side device receipt acknowledgement path. The system deliberately treats provider acceptance as *attempted*, not confirmed delivery.
- The existing graduation suggestion engine has no validated fully automatic readiness threshold; scheduler surfaces currently pending suggestions and monitoring-due contexts without manufacturing a new suggestion.
- Rich per-device delivery history and provider-specific receipt telemetry are not included in the frozen family pilot scope.
- A configured real PostgreSQL migration/UAT rehearsal is required before production promotion.
