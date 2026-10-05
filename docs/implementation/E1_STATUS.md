# Epic 1 status

Branch: `feat/e1-family-identity-sessions`

Implemented scope:

- guardian sign-in adapter
- family and child profile creation
- age-profile derivation
- experience preferences
- trusted household device enrollment/revocation
- child PIN setup/reset with Argon2id
- child-scoped sessions with opaque hashed tokens
- explicit parent unlock
- parent/child route shells
- profile switcher
- family-scoped and sibling-isolation authorization

Acceptance coverage:

- guardian first-family bootstrap and child creation
- age-profile boundaries and presentation-only preferences
- PIN hashing and configured lockout behavior
- child-session token hashing
- actor-resolution precedence, including guardian + active child session
- trusted device credential required
- revoked device denied
- parent-unlock expiry
- sibling private-resource isolation
- child denied parent access
- migration/schema smoke when DB smoke is enabled
- parent/child shell smoke where practical

Completion gate:

Epic 1 is complete only when the latest branch head passes the full CI `validate` and `smoke` jobs. E2 / `SELF_MAKE_BED` must not begin before E1 is merged.
