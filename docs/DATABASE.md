# Database Design

## 1. Design principles

- PostgreSQL is the source of truth.
- UUID primary keys are used for core entities.
- Foreign keys, unique constraints, check constraints, and indexes protect relationships.
- Numeric columns use `numeric`, not binary floating point, for marks, credits, weights, and grade points.
- Intake sessions and actual academic terms are separate entities.
- Students receive marks through explicit course enrollments.
- Result history uses immutable, versioned snapshots.
- Every table exposed through the public Supabase schema has RLS enabled by the initial migration.

## 2. Key table groups

| Domain | Tables | Purpose |
|---|---|---|
| Identity | `profiles`, `user_roles` | Auth-linked profiles and scoped app roles |
| Structure | `departments`, `programs`, `academic_sessions`, `semester_definitions`, `academic_terms` | Department/program, intake/cohort, reusable semester, actual term |
| People | `students`, `student_program_history`, `teachers` | Student and teacher records; effective-dated history of program/intake affiliation |
| Curriculum | `courses`, `program_courses`, `course_offerings`, `offering_teachers`, `course_enrollments` | Course catalog, program mapping, actual delivery, assignments and enrollment |
| Assessment | `assessment_schemes`, `assessment_scheme_categories`, `assessments`, `student_marks` | Versioned weights, assessment events, and marks/status |
| Policy | `grading_policies`, `grade_rules`, `result_calculation_policies` | Versioned grading scale, point values, repeat and missing-mark policy |
| Results | `course_results`, `semester_results`, `result_publications`, `result_corrections` | Versioned results, publication and correction record |
| Equivalency/audit | `course_equivalency_groups`, `course_equivalencies`, `audit_logs` | Repeat/equivalent-course mapping and audit records |

## 3. Important constraints

- Student number and teacher number are unique.
- Program codes are unique within a department.
- Course codes are unique within a department.
- Program/department/course relationships are checked with composite foreign keys.
- A course offering must map to a course included in that program's curriculum.
- A student can be newly enrolled only in an offering for their current program. Course enrollments retain the program associated with that historical attempt.
- Changes to a student’s department, program, or intake session append an effective-dated `student_program_history` record instead of erasing the prior affiliation.
- An enrollment/assessment pair can have only one mark row.
- A mark references an assessment and enrollment from the same offering.
- Marks cannot be negative or exceed the assessment maximum.
- A `present` mark row requires a numeric mark; a missing row is not interpreted as zero.
- An active assessment scheme must have configured category weights totaling 100%.
- An active grading policy must cover the 0–100 range without overlapping or gaps and must not exceed its GPA scale.
- Policy definitions become immutable after first activation; create a new version to change them.
- Submitted/approved/published course result states lock associated marks against ordinary updates.
- Published/locked course and semester result snapshots cannot be updated or deleted through ordinary operations.

## 4. Assessment weighting

An assessment scheme has one weight per category and can have multiple assessment events within a category. The intended category aggregation from the user requirements is:

`Category score = (sum of obtained marks / sum of maximum marks) × category weight`

`Final course marks = sum of weighted category scores`

This calculation is not yet implemented in SQL or application code. The initial migration only models and validates the scheme configuration and individual marks.

## 5. Identity and ownership

`profiles.id` is the same UUID as `auth.users.id`. The `students.profile_id` and `teachers.profile_id` columns connect academic records to login accounts. An after-trigger stores the first program/session assignment and appends a new history interval whenever a student’s department, program, or intake session changes. The trigger on `auth.users` creates a profile. Role assignment is controlled by trusted administrators and is not writable by ordinary profile updates.

## 6. Result snapshots

`course_results` stores a revision per course enrollment, with the calculation and grading policy identifiers, marks, grade, grade point, credits, status, and publication timestamp. `semester_results` stores a revision per student and academic term, including eligible credits, SGPA, CGPA, and policy identifiers. A correction should produce a new revision that supersedes the old record; the current migration does not yet provide the transactional correction RPC.

## 7. Migrations and generated types

Apply migrations from `supabase/migrations/`. Do not treat manual SQL editor changes as the canonical schema. After schema changes, regenerate Supabase TypeScript types and update the checked-in query types. The current `types/database.ts` covers only `profiles`, `user_roles`, and the dashboard summary RPC; it is not yet a full generated schema type.
