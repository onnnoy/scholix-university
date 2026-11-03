# Entity Relationship Diagram

This diagram shows the primary relationships in the first database migration. Audit and policy tables are included where they are key to result processing.

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : maps_to
  PROFILES ||--o{ USER_ROLES : assigned
  DEPARTMENTS ||--o{ PROGRAMS : contains
  DEPARTMENTS ||--o{ STUDENTS : owns
  DEPARTMENTS ||--o{ TEACHERS : employs
  PROGRAMS ||--o{ SEMESTER_DEFINITIONS : defines
  ACADEMIC_SESSIONS ||--o{ STUDENTS : intake_for
  PROGRAMS ||--o{ STUDENTS : current_program
  STUDENTS ||--o{ STUDENT_PROGRAM_HISTORY : affiliation_history
  PROGRAMS ||--o{ STUDENT_PROGRAM_HISTORY : historical_program
  ACADEMIC_SESSIONS ||--o{ STUDENT_PROGRAM_HISTORY : cohort_history
  PROGRAMS ||--o{ ACADEMIC_TERMS : delivers
  ACADEMIC_SESSIONS ||--o{ ACADEMIC_TERMS : period
  SEMESTER_DEFINITIONS ||--o{ ACADEMIC_TERMS : instance_of
  PROGRAMS ||--o{ PROGRAM_COURSES : curriculum
  COURSES ||--o{ PROGRAM_COURSES : included_in
  COURSES ||--o{ COURSE_OFFERINGS : offered_as
  ACADEMIC_TERMS ||--o{ COURSE_OFFERINGS : hosts
  ASSESSMENT_SCHEMES ||--o{ ASSESSMENT_SCHEME_CATEGORIES : configures
  ASSESSMENT_SCHEMES ||--o{ COURSE_OFFERINGS : applies_to
  COURSE_OFFERINGS ||--o{ OFFERING_TEACHERS : assigned
  TEACHERS ||--o{ OFFERING_TEACHERS : teaches
  COURSE_OFFERINGS ||--o{ COURSE_ENROLLMENTS : has
  STUDENTS ||--o{ COURSE_ENROLLMENTS : takes
  COURSE_OFFERINGS ||--o{ ASSESSMENTS : assesses
  ASSESSMENT_SCHEME_CATEGORIES ||--o{ ASSESSMENTS : category
  COURSE_ENROLLMENTS ||--o{ STUDENT_MARKS : receives
  ASSESSMENTS ||--o{ STUDENT_MARKS : records
  COURSE_ENROLLMENTS ||--o{ COURSE_RESULTS : produces
  GRADING_POLICIES ||--o{ GRADE_RULES : defines
  GRADING_POLICIES ||--o{ COURSE_RESULTS : interpreted_by
  RESULT_CALCULATION_POLICIES ||--o{ COURSE_RESULTS : calculated_by
  STUDENTS ||--o{ SEMESTER_RESULTS : receives
  ACADEMIC_TERMS ||--o{ SEMESTER_RESULTS : period
  GRADING_POLICIES ||--o{ SEMESTER_RESULTS : interpreted_by
  RESULT_CALCULATION_POLICIES ||--o{ SEMESTER_RESULTS : calculated_by
  ACADEMIC_TERMS ||--o{ RESULT_PUBLICATIONS : publishes
  COURSE_RESULTS ||--o{ RESULT_CORRECTIONS : may_correct
  SEMESTER_RESULTS ||--o{ RESULT_CORRECTIONS : may_correct
```

`AUTH_USERS` is managed by Supabase Auth; it is not a public application table. The full FK details and indexes are in the migration.
