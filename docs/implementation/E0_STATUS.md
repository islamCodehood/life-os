# Epic 0 status

Engineering foundation is active on `feat/e0-engineering-foundation`.

Implemented foundation areas:

- frozen specifications and agent instructions are repository-local
- Next.js App Router + strict TypeScript + pnpm
- pinned Life OS design-system consumption
- environment validation split by public/server scope
- private `life_os` PostgreSQL schema migration + Drizzle/node-postgres boundary
- request IDs, structured logging, stable error contract
- English/Arabic LTR/RTL shell
- PWA manifest + service-worker skeleton
- architecture, unit, integration and E2E smoke tests
- GitHub Actions quality gates

The next milestone is a fully green E0 CI run. E1 must not begin before that gate.
