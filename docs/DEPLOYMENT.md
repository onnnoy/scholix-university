# Deployment

## Environment separation

Use separate Supabase projects for local development, Vercel Preview, and Vercel Production where practical. Preview code must never write to real student records.

## Supabase

1. Create the production Supabase project.
2. Configure Auth site URL and redirect allow-list entries for the deployed app (`https://YOUR_DOMAIN/auth/callback`).
3. Link the repository using `npx supabase link --project-ref ...`.
4. Review and apply migrations with `npm run db:push`.
5. Create the first trusted Auth user and assign the first super-admin via the manual bootstrap SQL.
6. Confirm RLS is enabled on all public tables and run the database security test suite before importing real data.

## Vercel

1. Import the Git repository into Vercel.
2. Set the project framework to Next.js (normally auto-detected).
3. Configure environment variables for Preview and Production separately:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `DEMO_MODE=false`
4. Deploy and confirm the Auth callback works with the production URL.
5. Keep Supabase service/secret keys out of the browser and out of `NEXT_PUBLIC_` variables. This starter does not need a service-role key.

## Operational notes

- A successful local build does not prove the RLS model is secure; direct database tests are mandatory.
- Keep database migrations committed and reviewed.
- Establish backups/PITR appropriate to the institution's retention rules.
- Protect student result data under the university's data retention and privacy policies.
- Do not connect Preview deployments to Production student data.
- No scheduled jobs/background workers are required by the current starter.
