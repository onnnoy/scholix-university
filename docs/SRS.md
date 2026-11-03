# Software Requirements Specification

## 1. Purpose

Scholix is intended to manage university academic structures, assessments, marks, course outcomes, semester GPA, cumulative GPA, and student-facing published results. The system is academic administration software, not a finance or e-commerce application.

## 2. Users and roles

- **Super administrator:** institution-wide configuration and governance.
- **Department administrator:** scoped student, program, course, and offering administration.
- **Teacher/examiner:** assigned course rosters and marks entry.
- **Examination controller/result approver:** review and publication authority.
- **Student:** read-only access to their own published academic results.

One account may have more than one permitted role. Department-scoped roles must have an explicit department scope.

## 3. Academic structure

The model supports multiple departments, programs, intake sessions, reusable semester definitions, actual academic terms, students, teachers, courses, course offerings, and course enrollments. A student's intake session is historical cohort information; it is not the actual teaching/examination period of every later semester. The database keeps effective-dated program/intake history when a student changes affiliation.

## 4. Assessment requirements

An assessment scheme is associated with a course offering. The initial categories are assignment, class test, midterm, and final examination. Weights are configurable, and multiple assessments may belong to the same category. Marks must be scoped to a student enrollment and assessment. Missing marks remain missing/incomplete unless an explicitly approved institutional policy resolves them.

## 5. Result requirements

The intended system calculates final weighted course marks, letter grade, grade point, SGPA, and CGPA. Course/semester result records are versioned snapshots. Published snapshots must be historically explainable and not overwritten by routine updates.

## 6. Security and privacy requirements

- Use Supabase Auth and server-verified identity.
- Enforce authorization in server code and RLS, not only in UI controls.
- Students may see only their own published results.
- Teachers may access only assigned offerings and related records.
- Department administrators may access only their department scope.
- Privileged credentials must remain server-only; this starter does not require a service-role key.
- Corrections to published records require reason, actor, review, audit information, and republishing.

## 7. Current implementation status

The current repository includes project/authentication setup, a dashboard preview, a role-protected dashboard route, initial relational schema and RLS policies, and placeholder routes. The full assessment, calculation, reporting, and publication requirements remain future implementation work. See `README.md` for the exact boundary.
