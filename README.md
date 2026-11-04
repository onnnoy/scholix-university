# Scholix — University Academic Result Processing System

Next.js App Router, TypeScript, Supabase PostgreSQL/Auth/RLS and Edge Functions, deployed on Vercel.

## Implemented workflows
- Live super-admin dashboard and navigable management modules.
- Department, program, intake session, semester definition and academic term management.
- Create student and teacher login accounts. Each account gets a Supabase Auth identity, profile, role and academic record. Students are automatically enrolled in active course offerings for the selected program and intake session.
- Soft-deactivate/reactivate accounts and academic records so marks and historical results remain intact.
- Course catalog and course offering management, including teacher assignment.
- Assessment creation and marks entry with maximum-mark validation.
- Calculate and submit course results using the database assessment scheme and grading policy, then approve submitted course results.
- Student portal with published SGPA/CGPA snapshots and published component marks from earlier RPS records.
- Teacher portal with current and legacy assigned courses.

## Supabase Edge Functions
- `scholix-provision-account`: JWT-protected account provisioning.
- `scholix-admin-data`: JWT-protected admin operations and user-scoped student/teacher portal reads.

The service-role key is only used inside Supabase Edge Functions. Never expose it through `NEXT_PUBLIC_*` variables or browser code.

## Data model
The hosted Supabase project contains both normalized academic tables and earlier `rps_*` tables. Existing demo accounts and legacy published marks were preserved and linked to the new roster where possible. New administrative operations use normalized tables. Legacy marks are displayed as component marks; they are not presented as recalculated SGPA/CGPA.

The demo database includes an active 100-mark assessment scheme and 4.00 grading policy. Course calculation checks required marks and applies those database policies. Institution-specific absent/excused, repeat-course and equivalency rules still require formal approval. Do not calculate new semester CGPA using invented repeat-course rules.
