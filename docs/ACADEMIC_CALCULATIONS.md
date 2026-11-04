# Academic Calculation Specification

## 1. Current implementation status

**Course-level mark aggregation, grade assignment, submission, and approval are implemented in PostgreSQL. Semester-level SGPA/CGPA calculation and semester publication are not implemented.**

The authoritative course calculator reads marks, the assessment categories, course offering, grading-policy version, and grade rules from the database. The client does not submit a trusted total mark, letter grade, or grade point.

## 2. Course assessment aggregation

For every active assessment category:

Category score = (sum of obtained marks / sum of maximum marks) × category weight

Final course marks = sum of all weighted category scores

Multiple assessment events in one category are aggregated by summing obtained marks and maximum marks before applying that category's weight.

The active demo scheme in Supabase is **Standard 100 Mark Scheme, version 1**:

| Category | Weight | Required |
|---|---:|---|
| Assignment | 10% | Yes |
| Class Test | 10% | Yes |
| Midterm | 30% | Yes |
| Final Examination | 50% | Yes |
| **Total** | **100%** | |

A scheme must total exactly 100%, and each weighted category must have an active assessment before a course result can be calculated.

For the deterministic fixture 8/10, 9/10, 24/30, and 40/50, the calculation is:

(8/10 × 10) + (9/10 × 10) + (24/30 × 30) + (40/50 × 50) = 81.00

This result is a test example, not a semester GPA.

## 3. Completeness and statuses

A missing mark is not silently converted to zero. A mark row can be pending, present, absent, or excused.

- A present mark requires a numeric value from zero through the assessment maximum.
- pending, absent, and excused require the numeric value to be blank.
- Every required active assessment must have a present mark before course calculation.
- Until the university approves an absent/excused policy, those states block result calculation instead of being assumed zero or reweighted.
- Mark writes are rejected when the latest course result is submitted, under review, approved, published, or locked.

## 4. Configured demonstration grading scale

The active Supabase grading policy is named **Demo 4.00 Grading Scale**. Its database notes identify it as illustrative/demonstration configuration. It must not be described as a formally approved institutional regulation.

| Final course marks | Letter grade | Grade point |
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

The active demonstration policy uses a maximum GPA of 4.00, two decimal places, and half_up rounding. The course function rounds the final weighted course marks at the configured precision and then requires exactly one matching grade rule.

The current grade bands and calculation configuration are verified database values, but they remain **demo policy** until formally approved by the university. New policy versions should be created instead of modifying a policy version already used in a result snapshot.

## 5. Course result state and authorization

- The assigned active teacher or Super Administrator can calculate a draft course result.
- The assigned active teacher or Super Administrator can submit a draft course result.
- The Super Administrator or an Examination Controller with matching department scope can approve a submitted/under-review course result.
- A department administrator can manage draft marks and department records, but cannot approve course results or change institution-wide grading configuration.
- Marks lock after submission and remain read-only after approval/publication/locking.

## 6. SGPA and CGPA target formulas — planned

SGPA = sum(course credit × course grade point) / sum(eligible course credits)

CGPA = sum(counted course credit × course grade point) / sum(counted course credits)

Do not average semester GPAs to derive CGPA. The future calculation must aggregate eligible course attempts and apply the university's approved repeat/equivalency/credit policy.

The current system has SGPA/CGPA columns and can display existing published semester snapshots, but it does not yet calculate semester aggregates, create a complete semester result batch, approve/publish semester results, or populate the publication workflow end to end.

## 7. Policies still requiring university approval

The following must not be guessed:

- Whether failed courses count in CGPA and how retakes replace prior attempts.
- Whether repeated courses use the latest, highest, first, or all attempts.
- Whether students may improve a passing grade and which attempt counts.
- Whether absent assessments are zero, incomplete, or another outcome.
- How excused assessments are rescheduled or reweighted.
- Eligible-credit and non-credit course rules.
- Withdrawal, carryover, backlog, and late-correction rules.
- Official rounding at course, SGPA, and CGPA stages.

See OPEN_DECISIONS.md.

## 8. Authoritative calculation path

The database calculation must continue to load its own source marks, enrollments, category weights, grading-policy version, and grade rules. Keep the calculation in PostgreSQL numeric arithmetic and test every grade boundary immediately below, at, and above its transition. A separate unit-tested domain module may be used as an independent cross-check, but it must not become a second source of truth.

Future semester aggregation must verify actor/department scope, approved course-result states, target term, eligible credits, repeat policy, and grade-policy versions; create immutable revisions; and audit the actor and policy versions used.
