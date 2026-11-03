# Academic Calculation Specification

## 1. Current status

The current migration stores configurable assessment, grading, and repeat-course policies. **It does not yet calculate marks, grades, SGPA, or CGPA.** No production calculation should be inferred from the dashboard preview.

## 2. Assessment aggregation model from the requirements

For every assessment category:

`Category score = (sum of obtained marks / sum of maximum marks) × category weight`

Then:

`Final course marks = sum of all weighted category scores`

The initial migration requires each activated assessment scheme's category weights to total 100%. It permits multiple assessment records per category.

## 3. Completeness and statuses

A missing `student_marks` row is not zero. A mark row can be `pending`, `present`, `absent`, or `excused`. A `present` row requires a numeric mark. Negative marks and marks greater than the assessment maximum are rejected.

The migration models the policy choices `incomplete`, `treat_as_zero`, and `manual_resolution` for absent/excused handling. The institution must select and approve the correct rules. Until then, result generation must treat unresolved marks as incomplete.

## 4. Grading policy

`grading_policies` and `grade_rules` store a versioned GPA scale. Rules use a lower-inclusive and upper-exclusive interval convention; the terminal interval ending at 100 includes exactly 100. An activated policy must cover the complete 0–100 range without overlaps or gaps, and grade points must not exceed `maximum_gpa`. Activated policy definitions/rules are immutable; create a new policy version for a policy change.

No default letter-grade thresholds or grade points are seeded.

## 5. SGPA and CGPA target formulas

`SGPA = sum(course credit × course grade point) / sum(eligible course credits)`

`CGPA = sum(counted course credit × course grade point) / sum(counted course credits)`

Do not average semester GPAs to derive CGPA. The calculation must aggregate eligible course attempts and apply the university's repeat/equivalency/credit policy.

## 6. Required authoritative engine

Implement one authoritative calculation path in PostgreSQL RPC/functions (with a pure domain calculation module for independent unit tests only if the same rules are shared/verified). The database function must load source marks, course enrollment, assessment weights, course credits, grading version, and calculation policy from the database. It must use `numeric`/decimal-safe arithmetic and apply institutional rounding in one place.

The RPC must:

1. Verify actor role, department scope, result state, and target term.
2. Confirm all required assessment marks are resolved under the approved policy.
3. Aggregate multiple assessments within categories.
4. Calculate course marks and map marks to an immutable grading-policy rule.
5. Calculate SGPA from eligible credits.
6. Rebuild CGPA over eligible historical attempts using the active/versioned repeat policy.
7. Insert immutable result revisions in one transaction.
8. Audit the actor and policy versions used.

## 7. Rounding

The schema provides `decimal_places` and rounding mode fields. The institution must approve the precision and mode. Do not round individual assessment/category values earlier than the official specification requires. Prefer rounding only at explicit stage boundaries defined by the university.
