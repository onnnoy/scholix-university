# Scholix — University Academic Result Processing System

Next.js App Router, TypeScript, Supabase PostgreSQL/Auth/RLS and Edge Functions, deployed on Vercel.

## Implemented workflows
- Live super-admin dashboard and navigable management modules.
- Department, program, intake session, semester definition and academic term management.
- Create student and teacher login accounts. Each account gets a Supabase Auth identity, profile, role and academic record. Students are automatically enrolled in active course offerings for the selected program and intake session.
- Soft-deactivate/reactivate accounts and academic records so marks and historical results remain intact.
- Course catalog and course offering management, including teacher assignment.
- Assessment creation, active offering/teacher assignments, and role-scoped marks entry with maximum-mark and result-lock validation.
- Teacher portal for assigned-course rosters, per-assessment marks/status entry, and Calculate & submit for examination review.
- Department Administrator workspace with department-scoped student/teacher provisioning, academic record management, teacher assignment, and draft-mark correction.
- Examination Controller workspace for read-only course-result review and scoped approval; no general academic-record or marks write permissions.
- Course-result calculation using the offering's configured assessment scheme and grading-policy version, plus course-result submission and approval.
- Student portal with display of existing published semester SGPA/CGPA snapshots and historical component marks. Semester SGPA/CGPA aggregation and semester publication remain planned.

## Supabase Edge Functions
- `scholix-provision-account`: JWT-protected account provisioning.
- `scholix-admin-data`: JWT-protected role-scoped administration, assigned-teacher grading, course-result submission/approval, and user-scoped student/teacher portal reads.
 
Role permissions are enforced by server-side guards, Edge Function checks, PostgreSQL RPC checks, and RLS. Department Administrators are scoped to their own department; teachers are scoped to assigned active offerings; Examination Controllers can read/approve results but cannot edit marks or academic records.

The service-role key is only used inside Supabase Edge Functions. Never expose it through `NEXT_PUBLIC_*` variables or browser code.

## Data model
The hosted Supabase project contains both normalized academic tables and earlier `rps_*` tables. Existing demo accounts and legacy published marks were preserved and linked to the new roster where possible. New administrative operations use normalized tables. Legacy marks are displayed as component marks; they are not presented as recalculated SGPA/CGPA.

The demo database includes an active 100-mark assessment scheme and 4.00 grading policy. Course calculation checks required marks and applies those database policies. Institution-specific absent/excused, repeat-course and equivalency rules still require formal approval. Do not calculate new semester CGPA using invented repeat-course rules.
