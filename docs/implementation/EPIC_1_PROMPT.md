# Epic 1 Prompt — Family Identity + Child-Scoped Sessions

## Task

Implement **E1 — Family identity and child-scoped sessions** on top of the merged E0 foundation.

Do not implement activities, XP, money, goals, jobs, reminders, recovery, graduation, Visual World business rules, or E2's Make Bed behavior in this epic.

## Stories

- Guardian sign-in adapter behind `GuardianAuthGateway`.
- Create family.
- Create child profile.
- Derive age profile from birth date without treating age as capability.
- Store/update experience preferences separately from age defaults.
- Enroll/revoke trusted household devices.
- Set/reset child PIN using Argon2id.
- Create/revoke child-scoped sessions with opaque token + server-side hash only.
- Parent unlock on shared child device with configurable short expiry.
- Parent and child route shells with server authorization.
- Explicit profile switcher.

## Acceptance

- Guardian can create a family and child profile.
- Child can enter with PIN only on a trusted, non-revoked household device.
- Child actor cannot access parent route/API.
- One child cannot access a sibling's private resources.
- Parent unlock expires according to typed server configuration.
- Revoked household device cannot create a new child session.

## Security constraints

- Raw child session tokens and raw device tokens exist only in Secure HttpOnly cookies.
- Persist only token hashes.
- PINs are never logged or stored; persist Argon2id hashes only.
- Repeated PIN failures produce cooldown/lockout behavior.
- Actor resolution order is:
  1. valid explicit parent-unlock context;
  2. active child-session cookie;
  3. valid guardian session;
  4. unauthenticated.
- A guardian cookie must not silently elevate an active child session.
- Family scope is enforced server-side.
- Sibling resources are concealed.
- Browser code never accesses PostgreSQL/Supabase service credentials directly.

## Product constraints

Age bands:
- 6–8 Explorer → recommended Immersive.
- 9–12 Builder → recommended Balanced.
- 13–15 Navigator → recommended Focused.
- 16–17 Launch → recommended Focused.

These are recommended presentation defaults only. They never set autonomy or capability.

Experience preference:
- visualization: Immersive | Balanced | Focused
- motion: Full | Reduced | Off
- theme key is presentation-only

## Implementation notes

The frozen ActorContext requires a family ID. Creating the first family therefore uses a pre-family `GuardianIdentity` obtained from the GuardianAuthGateway. This is a bootstrap authentication context only; after family creation all domain command/query authorization uses the frozen ActorContext.

All E1 mutations remain HTTP command/API operations. Do not use Server Actions for domain mutations.

## Required tests

- age-profile boundary tests;
- experience preference does not alter age profile;
- PIN hash/verify tests;
- child-session token hashing tests;
- actor-resolution precedence tests;
- child cannot become guardian because a guardian cookie also exists;
- trusted device required for child session;
- revoked device denied;
- PIN lockout behavior;
- parent-unlock expiry;
- sibling isolation authorization;
- guardian family/child creation application tests;
- migration/schema smoke when DB test environment is configured;
- parent/child route authorization smoke where practical.

## Deliverable

At completion report migrations, files changed, identity/session behavior, tests/results, external Supabase/dev DB setup still needed, ambiguities, and deviations.
