# Scholix — University Academic Result Processing System

A fresh **Next.js + Supabase** project foundation for university academic administration and result processing. The interface follows the supplied Scholix reference: compact white cards, subtle borders, soft green accents, a left navigation rail, and dashboard charts.

> **Current delivery status:** this repository is a runnable starter and dashboard preview, not a finished production result-processing system. It includes the Next.js application foundation, Supabase SSR authentication wiring, a first PostgreSQL schema/RLS migration, role-aware route guards, a demo dashboard, and project documentation. CRUD modules, the authoritative marks/GPA calculation RPCs, approvals/publication RPCs, and the student/teacher workflows remain to be implemented and tested in later development phases.

## Stack

- Next.js App Router, React, TypeScript (strict)
- Tailwind CSS 4 and Lucide React
- Supabase PostgreSQL, Auth, RLS, and migrations
- `@supabase/ssr` browser/server clients and Next.js `proxy.ts` session refresh
- Zod for input/schema validation
- Vitest and Playwright test scaffolding
- Vercel-compatible Next.js deployment

## Run the UI preview

Requirements: Node.js 22.12 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The starter `.env.example` enables `DEMO_MODE=true` with empty Supabase credentials, so the root route opens the dashboard preview. The figures and chart samples in that view are explicitly demonstration data; do not use them as real university records.

## Connect Supabase

1. Create a Supabase project.
2. Copy the Project URL and publishable key from the Supabase project API settings into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   DEMO_MODE=false
   ```

3. Install/use the Supabase CLI and link this directory to the project:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   For a local Supabase stack instead, use `npx supabase start` followed by `npm run db:reset`.

4. In Supabase Authentication, create the first user. The migration creates a matching `public.profiles` row from `auth.users`.
5. Copy that user's UUID and run `supabase/bootstrap/assign-first-super-admin.sql` in the Supabase SQL editor, replacing `REPLACE_WITH_AUTH_USER_UUID`. This bootstrap file is intentionally manual and must only be used for the first trusted administrator.
6. Add `http://localhost:3000/auth/callback` to the Supabase Auth redirect allow-list. For production, add your deployed Vercel origin and its `/auth/callback` URL as well.
7. Sign in through `/login` using the account created in Supabase.

The local CLI commands and database project setup are described in more detail in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Supabase publishable key; RLS must protect exposed data |
| `DEMO_MODE` | Server | Enables sample-only dashboard preview when Supabase is not configured |

No service-role key is required by this starter. **Never put Supabase secret/service-role keys in a `NEXT_PUBLIC_` variable or commit them.**

## Available routes

| Route | Current behavior |
|---|---|
| `/` | Redirects to demo dashboard in local preview mode, otherwise to sign-in |
| `/login` | Supabase email/password sign-in |
| `/auth/callback` | PKCE code exchange and safe relative redirect |
| `/admin/dashboard` | Responsive academic administration dashboard |
| `/admin/*` | Protected module placeholders for future academic CRUD/workflows |
| `/student/dashboard` | Role-protected student portal placeholder |
| `/teacher/dashboard` | Role-protected teacher workspace placeholder |

## Database foundation

The initial migration is `supabase/migrations/202611030001_initial_academic_schema.sql`. It creates normalized tables for:

- Profiles and scoped role assignments
- Departments, programs, intake sessions, effective-dated student program history, semester definitions, and actual academic terms
- Students, teachers, courses, program curricula, course offerings, and course enrollments
- Versioned assessment schemes, assessment categories, assessments, and student marks
- Versioned grading and result-calculation policy records
- Course equivalencies, versioned course/semester result snapshots, publications, corrections, and audit logs

RLS is enabled on the public tables created in that migration. Policies are deny-by-default unless an explicit read/write policy grants access. The database model distinguishes a student's original intake from the actual session/term in which a semester is delivered.

The schema is a **first-pass foundation** and needs a Supabase local/hosted migration run plus policy tests before production use. Result processing and publication are not yet implemented as transactional RPCs. The current result snapshot tables intentionally have no direct client write policies; future trusted database functions must validate source marks and policies, calculate results, and publish atomically.

## Development commands

```bash
npm run dev          # Start local app
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint
npm run typecheck    # TypeScript checks
npm test             # Unit tests
npm run test:watch   # Unit tests in watch mode
npm run test:e2e     # Playwright end-to-end tests
npm run db:reset     # Reset local Supabase database and apply migrations
npm run db:push      # Push migrations to linked Supabase project
npm run db:types     # Generate local Supabase TypeScript types
```

`npm run db:types` writes `types/database.generated.ts`. Review the generated output and update `types/database.ts`/query typings when the schema changes; the checked-in `types/database.ts` currently types the authentication and dashboard queries only.

## Implementation boundaries

Not implemented yet:

- Academic CRUD pages, student/teacher/course imports, and enrollment management
- Assessment configuration and spreadsheet-like marks entry UI
- The single authoritative decimal-safe calculation engine
- Grade-rule lookup, SGPA/CGPA, repeat/improvement rules, and credit policies
- Transactional result submission, review, approval, publication, and correction RPCs
- Student semester result pages, transcript generation, print/PDF export, and reports
- Full RLS integration tests, calculation test matrix, and browser tests against a real Supabase project

Institution-specific decisions are deliberately not guessed. See [docs/ACADEMIC_CALCULATIONS.md](docs/ACADEMIC_CALCULATIONS.md) and [docs/OPEN_DECISIONS.md](docs/OPEN_DECISIONS.md).

## Documentation

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md), and [docs/ERD.md](docs/ERD.md). The other documents describe requirements, security, calculation rules, lifecycle, test plans, development, deployment, and unresolved institutional policies.
