# Epic 0 Prompt — Engineering Foundation

## Task

Implement **E0 — Engineering Foundation** for the Life OS application repository.

Do not implement E1 identity flows, E2 activities, money, XP, goals, jobs, autonomy, graduation, reminders, or business-domain behavior in this epic.

## Authoritative references

Read, in order:

1. root `AGENTS.md`
2. frozen System Design V0.1–V0.4
3. System Architecture V1.0–V1.3
4. Implementation Specification V2.0–V2.3, especially repository topology, dependency direction, environments, CI, and E0
5. Life OS design-system handoff:
   - `docs/IMPLEMENTATION_HANDOFF.md`
   - `docs/MAGICPATH_HANDOFF_V3.3.md`
6. `@life-os/design-system` Storybook V3.3

## E0 stories

Implement exactly:

- E0-S1 Bootstrap Next.js / TypeScript / pnpm.
- E0-S2 Configure strict TypeScript, lint, formatting, Vitest, Playwright.
- E0-S3 Create server/public environment validation.
- E0-S4 Configure Supabase local/dev conventions and private `life_os` schema.
- E0-S5 Configure Drizzle + node-postgres with separate runtime/migration URLs.
- E0-S6 Add request IDs, structured server logging, and stable API error contract.
- E0-S7 Add Arabic/English shell and RTL/LTR primitives.
- E0-S8 Add PWA manifest/service-worker skeleton.
- E0-S9 Add GitHub Actions quality gates and Vercel-ready deployment configuration.

## Bootstrap requirements

### Runtime/framework

- Node 24 LTS.
- Next.js 16 Active LTS; pin the latest security-patched 16.3 release approved at bootstrap.
- TypeScript strict.
- pnpm with committed lockfile.
- App Router.
- No Pages Router.

### Core dependencies

Foundation should prepare or install:

- `next`
- `react`, `react-dom`
- `zod`
- `@tanstack/react-query`
- `dexie`
- `react-hook-form`
- `@hookform/resolvers`
- `drizzle-orm`
- `drizzle-kit`
- `pg`
- Supabase JS/SSR packages required by the auth adapter boundary
- `vitest`
- Playwright
- lint/format tooling chosen for the repo
- public pinned `@life-os/design-system` GitHub dependency

Do not introduce Redux.

### Design system

Pin:

`github:islamCodehood/life-os-design-system#b69e66f589b80faf9968a2ace0e08737bfc2b8f0`

Use its exported components/styles. Add one smoke page/shell proving the application can consume the package.

Do not copy its CSS/components into the application.

### Repository topology

Create the approved modular-monolith skeleton. Empty directories may use a short README or `.gitkeep` only where useful.

The domain layer must be framework-free.

Add an architecture guard test or lint rule that fails forbidden imports:

- domain → React/Next.js
- domain → Drizzle/Supabase/Dexie/Vercel
- browser UI → database infrastructure
- browser code → server-only environment modules

## Environment validation

Create typed validation that distinguishes server-only from public variables.

Server-only placeholders:

- `DATABASE_URL_RUNTIME`
- `DATABASE_URL_MIGRATION`
- `SUPABASE_SERVICE_ROLE_KEY` only if later required
- `CHILD_SESSION_HASH_SECRET`
- `INTERNAL_SCHEDULER_SECRET`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Public-safe placeholders:

- `NEXT_PUBLIC_APP_ORIGIN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

E0 must not require future optional secrets merely to render/build local shell pages. Separate required-now vs optional/future configuration cleanly.

Never expose server-only values through client imports.

Provide `.env.example` with no secrets.

## Database foundation

- Add Drizzle config.
- Add `life_os` PostgreSQL schema creation migration.
- Document runtime vs migration connection usage.
- Runtime application role must conceptually be non-owner and non-superuser.
- Browser receives no private schema credentials.
- Add a database connectivity/health smoke path or test that runs only when DB env is configured.
- Do not implement E1 domain tables unless explicitly required for a health check.

## Request/error/logging foundation

Create:

- request ID generation/propagation;
- structured server logger interface;
- stable error response shape;
- error-to-HTTP mapping boundary;
- redaction rules.

Do not log secrets, auth tokens, PINs, or sensitive child content.

A minimal API health endpoint is allowed.

## i18n / bidi foundation

Support English and Arabic shells from E0.

Requirements:

- locale-aware root `lang` + `dir`;
- no left/right layout assumptions in new app CSS;
- bidi isolation for mixed-language values;
- English and Arabic smoke pages/tests;
- design-system import rendering under both directions.

Do not build a full translation-management platform.

## PWA foundation

Add:

- web app manifest;
- install metadata;
- service-worker registration skeleton;
- safe static/offline-shell strategy only;
- no caching mutation POST responses;
- no business-domain offline engine yet.

E3 will implement the durable command outbox.

## Providers

Create minimal provider boundaries for:

- TanStack Query;
- future actor/session context;
- i18n;
- service-worker lifecycle if needed.

Do not put business rules in providers.

## CI

Pull-request CI must run at minimum:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:domain
pnpm test:unit
pnpm test:integration
pnpm build
```

Add a smoke E2E job when practical for the shell/health route.

Do not auto-apply destructive migrations from PRs.

## Tests required

At minimum:

1. architecture/import-boundary test;
2. environment validation tests;
3. API error-contract test;
4. request-ID propagation smoke;
5. English shell renders `dir=ltr`;
6. Arabic shell renders `dir=rtl`;
7. design-system package renders from the application;
8. manifest is valid;
9. service worker does not cache mutation POST requests;
10. DB smoke test is conditional and fails clearly when explicitly enabled with invalid connectivity;
11. production build passes.

## E0 acceptance criteria

Do not mark E0 complete until all are true:

- production build succeeds;
- CI blocks type/test failures;
- preview deployment configuration is ready and can be linked to Vercel;
- DB connectivity smoke passes in an environment with configured dev DB;
- Arabic and English shells render correct direction;
- no private database access exists in the browser bundle;
- domain import-boundary checks pass;
- design-system dependency is consumed without copying its implementation;
- no E1/E2 business behavior has leaked into foundation code.

## Required deliverable structure

At completion report:

### Files changed
List created/modified files grouped by concern.

### Dependencies
List every dependency added and why.

### Database
List migration(s) and connection assumptions.

### Tests
List exact commands and results.

### Environment
List variables introduced and whether public/server-only/optional.

### Architecture checks
State which forbidden imports are automatically enforced.

### Remaining external setup
List only actions that require external credentials/resources, e.g. Supabase project secrets or Vercel project linking.

### Ambiguities/deviations
Normally none. If non-empty, stop before inventing behavior.
