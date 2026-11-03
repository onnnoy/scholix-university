# Unresolved Institutional Decisions

These policies must be supplied and approved by the university. The project intentionally does not seed assumed values.

| Decision | Questions to approve | Current schema support |
|---|---|---|
| Grading scale | GPA maximum, mark intervals, letter grades, grade points, pass/fail thresholds | Versioned `grading_policies` and `grade_rules` |
| Assessment weights | Category weights, required categories, optional categories, rounding at category level | Versioned `assessment_schemes` and categories; activation requires 100% total |
| Assessment aggregation | How multiple assignments/tests within one category combine; dropped lowest mark? weighted events? | Current specification assumes ratio of total obtained to total maximum within category; confirm before implementation |
| Pass requirements | Overall pass mark, component-specific minimum, theory/practical minimum, course-specific rule | Needs policy attributes/rules added once approved |
| Absence | Does absent mean zero, incomplete, or another institutional outcome? | `absent_mark_policy` enum; not configured |
| Excused assessment | Resit, reweight remaining categories, carry forward, or manual resolution? | `excused_mark_policy` enum; not configured |
| Repeated courses | Latest, highest, first, all attempts, or replacement? | `repeat_course_policy` enum; not configured |
| Course improvement | Can a student retake a passed course to improve grade? Which attempt counts? | Course equivalency groups and repeat policy groundwork |
| CGPA scope | Whether all completed eligible courses count; effect of failed courses and withdrawals | Needs final institutional rule before calculation RPC |
| Credits | Whether non-credit courses count, and how practical/lab/retake credits are handled | Course credit and `is_credit_bearing`; calculation policy flag |
| Rounding | Decimal places and rounding mode at course, SGPA, and CGPA stages | Policy fields exist; values require approval |
| Term progression | Rules for carryover courses, backlogs, and late result corrections | Workflow and academic status rules need confirmation |

A default policy may be used for local fixtures only after it is prominently marked as test data and must not become the production institution policy by accident.
