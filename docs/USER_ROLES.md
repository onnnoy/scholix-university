# User Roles and Permissions

This document describes the active application and database permission model, not merely the intended future design.

| Capability | Super Administrator | Department Administrator (scoped) | Teacher (assigned offering) | Examination Controller (scoped/global) | Student (self) |
|---|---:|---:|---:|---:|---:|
| Read academic records | All departments | Own department | Assigned offerings and related roster | Read-only results and related academic context within scope | Own enrollment and published results |
| Manage departments and global sessions | Yes | No | No | No | No |
| Manage programs, semesters, terms, courses, and offerings | All departments | Own department | No | No | No |
| Provision student/teacher accounts | All departments | Own department | No | No | No |
| Assign teachers to offerings | All departments | Own department | No | No | No |
| Enter/update draft marks | All departments | Own department | Assigned active offerings only | No | No |
| Calculate and submit course results | Administrative oversight | No | Assigned active offerings only | No | No |
| Approve course results | Yes | No | No | Submitted/under-review results within scope | No |
| Configure global assessment/grading policies | Yes | No | No | Read only | No |
| Calculate SGPA/CGPA and publish semester results | Not available yet | Not available yet | No | Not available yet | Read published snapshot only |
| Manage user role assignments | Yes | No | No | No | No |

## Responsibility boundaries

- **Super Administrator:** institution-wide setup, grading-policy and assessment-scheme configuration, oversight, account provisioning, and exceptional administration.
- **Department Administrator:** manages student/teacher records and academic structures within the assigned department; assigns teachers to that department's offerings; can enter or correct draft marks in the same department. Cannot approve course results or change global grading policies.
- **Teacher:** enters student marks only for active offerings assigned to that teacher. Once all required marks are complete, the teacher runs calculation/submission for that offering. Marks are locked after submission.
- **Examination Controller:** reviews submitted course results and approves only results within the controller's department. A controller whose role row has a NULL department is global. This role is read/approve, not a general academic-record editor or mark-entry role.
- **Student:** can access only their own published semester-result snapshots. No student-supplied UUID is accepted as an authorization substitute.

## Scope and account-state rules

- A super_admin role is institution-wide.
- A department_admin role requires a department ID and applies only to that department.
- An exam_controller with a department ID is scoped to that department; an examiner with a NULL department is global.
- A teacher's course access comes from offering_teachers, combined with an active teacher role, active profile, and active teacher record.
- All role checks require an active role row and an active profile/account.
- Server-side route guards, Edge Function authorization, database RPC checks, and Row Level Security must agree. Hiding a menu item is not an authorization control.

## Role-to-route behavior

- Super Administrator sees the institution-wide administration navigation.
- Department Administrator is routed to the department workspace and sees department-scoped management modules.
- Examination Controller is routed to result review and sees read/approval modules only.
- Teacher uses the Teacher portal for assigned-course grading and result submission.
- Student uses the Student portal for their own published results.

## Demo roles

The current named demo staff role mapping is:

| Account | Active role | Scope |
|---|---|---|
| admin@scholix.demo | super_admin | Institution-wide |
| department@scholix.demo | department_admin | ECE department |
| controller@scholix.demo | exam_controller | Global |
| teacher@scholix.demo | teacher | CSE department and assigned offerings |

Demo account passwords are not stored in this file.
