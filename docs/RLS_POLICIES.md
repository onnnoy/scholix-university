# Supabase RLS Design

## Baseline

The initial migration enables RLS on every public table it creates, revokes anon/public table access, grants authenticated table privileges only as a starting point, and uses explicit policies to decide which rows and operations are available. An operation with no applicable policy is denied.

## Authorization helpers

- `has_app_role(role_array, department_id)` checks active profile and active role assignment, then enforces role scope.
- `is_offering_teacher(offering_id)` verifies active teacher/account membership in the offering-teacher relation.
- `is_student_owner(student_id)` verifies the authenticated profile owns the student row and holds an active student role.
- `is_student_enrolled_in_offering(offering_id)` verifies the authenticated student is actively enrolled.
- `can_access_student`, `can_access_program`, `can_access_course`, and `can_access_assessment_scheme` provide narrow read-visibility checks.

These helper functions are `SECURITY DEFINER`, use a fixed `search_path`, qualify table names, and return boolean decisions rather than exposing row data. Their `EXECUTE` grants are limited to authenticated users.

## Core policy behavior

- Students can select only their own student profile and their own published/locked result snapshots.
- Teachers can read roster/assessment/marks records only in offerings assigned to them. They may insert/update marks for those offerings subject to database triggers and constraints.
- Department admins are limited to their authorized department in management policies.
- Exam controllers can read result data in their assigned department scope or globally if their role assignment is global.
- Super admins can perform institution-wide administration.
- Student accounts have no direct write policy for marks or results.
- Result snapshots have read-only policies; ordinary authenticated clients cannot insert, update, or delete them.
- `result_corrections` supports a scoped request insert/read baseline, but no review/apply RPC is implemented.

## Additional database guards

RLS does not replace constraints/triggers. The migration also validates mark maximums, enrollment/offering relationships, assessment/category relationships, active scheme weights, active grading coverage, immutable activated policy definitions, and locks marks when a course result has progressed to submitted or later states.

## Important implementation gap

The migration is a security foundation, not a completed authorization test suite. Run local Supabase tests before using real data. Add direct Data API tests for UUID substitution, role escalation, cross-department reads/writes, teacher access to unrelated offerings, and student access to unpublished/other-student results. The result calculation/publication RPCs must independently verify role and department scope and must never trust client-supplied grade/SGPA/CGPA values.
