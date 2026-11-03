# Local Development

## Prerequisites

- Node.js 22.12+
- npm
- Git
- Supabase CLI (local binary or `npx supabase`)
- Docker Desktop/Engine if using the local Supabase stack

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Local preview uses the sample dashboard only when `DEMO_MODE=true` and Supabase credentials are absent. Once Supabase credentials exist, the app stops using demo mode even if that variable is accidentally left enabled; set `DEMO_MODE=false` explicitly for connected environments.

## Supabase local development

```bash
npx supabase start
npm run db:reset
```

The CLI will print local project URL and keys. Put the local URL and publishable/anon key (depending on the CLI version) in `.env.local`. Supabase Auth signup is disabled in the provided config; create test users through the local Studio/Auth interface or a controlled seed/administrative script.

To link a hosted environment:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:push
```

## First administrator

1. Create an Auth user from Supabase Studio or the hosted dashboard.
2. Locate the Auth user UUID.
3. Open `supabase/bootstrap/assign-first-super-admin.sql`.
4. Replace its explicit placeholder UUID and run it with trusted SQL-editor privileges.
5. Sign in at `/login`.

Do not expose a public endpoint that grants a super-admin role. The bootstrap operation is deliberately manual.

## Code conventions

- Use Server Components by default.
- Add `"use client"` only where state/event handlers are needed.
- Keep feature business rules outside page files.
- Validate untrusted form input with Zod.
- Use the server Supabase client for server work and the browser client only for safe user-scoped operations.
- Keep RLS as the final row authorization boundary.
- Use PostgreSQL transactions for multi-row academic state changes.
- Add migrations for every schema change.

## Tests and checks

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

The E2E config starts the app in sample preview mode. Security/integration tests must run against a local Supabase stack after being added; demo-browser tests do not prove RLS correctness.
