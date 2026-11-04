# Unresolved Institutional Decisions

The Supabase project currently contains **demo configuration values** for course assessment and grade calculation. The existence of active rows does not mean the university has approved them as official academic regulations. Obtain written institutional approval before presenting them as the university's grading policy or using them to publish official semester results.

## Active demonstration configuration (verified in Supabase)

### Assessment weights

| Category | Weight | Required |
|---|---:|---|
| Assignment | 10% | Yes |
| Class Test | 10% | Yes |
| Midterm | 30% | Yes |
| Final Examination | 50% | Yes |
| **Total** | **100%** | |

### Grade scale

| Marks | Grade | Grade point |
|---:|---|---:|
| 80–100 | A+ | 4.00 |
| 75–79.9999 | A | 3.75 |
| 70–74.9999 | A− | 3.50 |
| 65–69.9999 | B+ | 3.25 |
| 60–64.9999 | B | 3.00 |
| 55–59.9999 | B− | 2.75 |
| 50–54.9999 | C+ | 2.50 |
| 45–49.9999 | C | 2.25 |
| 40–44.9999 | D | 2.00 |
| 0–39.9999 | F | 0.00 |

The active demonstration grade policy is named Demo 4.00 Grading Scale. It uses a maximum GPA of 4.00, two decimal places, and half_up rounding. Its database notes describe it as illustrative/demonstration configuration. The course calculator uses the currently assigned database scheme and grading-policy version.

## Decisions still requiring university approval

| Decision | Questions to approve | Current implementation / schema support |
|---|---|---|
| Official grading scale | GPA maximum, mark intervals, letter grades, grade points, pass/fail thresholds | A versioned demo policy is active; official thresholds still require approval. |
| Official assessment weights | Category weights, required categories, optional categories, rounding | A versioned 10/10/30/50 demo scheme is active; approve or replace it before official use. |
| Assessment aggregation | How multiple assignments/tests within one category combine; dropped lowest mark? weighted events? | Current course calculator uses ratio of total obtained to total maximum within category. Confirm this institutional rule. |
| Pass requirements | Overall pass mark, component-specific minimum, theory/practical minimum, course-specific rule | Current demo scale marks 40 as D / 2.00 and below 40 as F / 0.00; additional component minima are not configured. |
| Absence | Does absent mean zero, incomplete, or another institutional outcome? | Current required absent mark blocks course-result calculation. |
| Excused assessment | Resit, reweight remaining categories, carry forward, or manual resolution? | Current required excused mark blocks course-result calculation. |
| Repeated courses | Latest, highest, first, all attempts, or replacement? | Not implemented in semester aggregation; schema policy groundwork exists. |
| Course improvement | Can a student retake a passed course to improve grade? Which attempt counts? | Not implemented. |
| CGPA scope | Whether all completed eligible courses count; effect of failed courses and withdrawals | Semester SGPA/CGPA aggregation is not implemented until this is approved. |
| Credits | Whether non-credit courses count, and how practical/lab/retake credits are handled | Course credit and is_credit_bearing fields exist; eligibility rule is not applied to a GPA calculator yet. |
| Rounding | Decimal places and rounding mode at course, SGPA, and CGPA stages | Demo course grading uses 2 decimals / half_up; official policy and semester-level rounding need approval. |
| Term progression | Rules for carryover courses, backlogs, and late result corrections | Not implemented end to end. |

## Why semester GPA is still blocked

Course-level weighted marks, letter grades, and grade points can now be calculated from the active database configuration. The system does **not** yet calculate SGPA/CGPA from approved course results or run a semester-level approval/publication batch. These steps depend on the decisions above, especially repeated/failed courses, credit eligibility, withdrawals, and absence/excused handling.

A local/demo policy may be used for QA, but it must remain visibly marked as test data and must not silently become the institution's official policy.
