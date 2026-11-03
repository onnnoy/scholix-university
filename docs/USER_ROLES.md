# User Roles and Permissions

| Capability | Super admin | Department admin (scoped) | Teacher (assigned offering) | Exam controller (scoped/global) | Student (self) |
|---|---:|---:|---:|---:|---:|
| Read departments / academic sessions | Yes | Yes | Yes | Yes | Yes |
| Manage departments / global sessions | Yes | No | No | No | No |
| Manage program/semester structures | Yes | Own department | No | Read scoped data | Read related data |
| Manage students and teachers | Yes | Own department | No | Read scoped data | Own profile only |
| Manage courses/offerings/enrollments | Yes | Own department | No | Read scoped data | Read own enrolled offerings |
| Read assigned offering/roster | Yes | Own department | Assigned only | Scoped | Own enrollment |
| Enter/update draft marks | Yes | Own department | Assigned offering | No ordinary mark-write grant | No |
| Configure assessment/grading policy | Central configuration | No in initial migration | No | Read scoped policy | No |
| Read draft/unpublished results | Yes | Own department | No direct course-result read in initial policy | Own department | No |
| Read published results | Yes | Own department | No direct course-result read in initial policy | Own department | Own published results |
| Publish/correct official results | Future authorized RPC | Future review path | No | Future authorized RPC | No |
| Manage user role assignments | Yes | No | No | No | No |

## Scope rules

- A `super_admin` role is institution-wide.
- A `department_admin` role requires a department ID and applies only to that department.
- An `exam_controller` role may be global (NULL department) or department-scoped.
- A teacher's course access comes from `offering_teachers` plus an active teacher role and active profile/teacher record.
- A student's ownership is derived from the authenticated profile linked to `students.profile_id`; a browser-supplied student UUID alone is never sufficient.

The table above describes the intended target permissions and the current migration baseline. Result approval/publication RPC authorization is not implemented yet, so those operations are not available.
