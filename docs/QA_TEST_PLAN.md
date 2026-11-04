# Scholix QA Test Plan and Front-end Accessibility Audit

**Document status:** Draft test plan and source-code review  
**Scope baseline:** Current Next.js App Router application, Supabase Auth/Postgres/RLS/Edge Functions, Vercel deployment  
**Execution status:** The cases below are planned. They are not represented as passed until run against a deployed or seeded test environment.

## 1. Scope and application baseline

Scholix manages university academic records across departments, programs, intake sessions, semesters, academic terms, students, teachers, courses, course offerings, assessment schemes, assessment records, marks, course results, approvals, and student-visible published results.

The active UI routes inspected for this review are:

- Administrator: /admin/dashboard and the /admin/* management modules.
- Student: /student/dashboard.
- Teacher: /teacher/dashboard.
- Authentication: /login.

The current repository README describes these implemented workflows: administrator management modules; student and teacher account provisioning; soft deactivation/reactivation; course and offering management; teacher assignment; assessments and mark entry; course-result calculation/submission/approval; student display of published semester snapshots and legacy component marks; and teacher display of assigned courses.

The QA plan tests the implemented behavior and also marks requirement gaps that must not be mistaken for passed functionality.

### Current implementation status and remaining release risks

1. **Role authorization:** the current main-branch UI, Edge Functions, and database policies have been aligned around separate Super Administrator, Department Administrator, Teacher, Examination Controller, and Student responsibilities. The active Supabase functions are scholix-admin-data version 11 and scholix-provision-account version 3. Database role checks require active role/profile/account status; department data is scoped; the Examination Controller has read/approval permissions rather than general write permissions. Run ROLE-01 through ROLE-05 and SEC-03 before release.
2. **Teacher grading workflow:** the Teacher portal now loads assigned active offerings, enrolled student rosters, assessments, existing marks, and locked result state. It provides per-assessment status/mark entry, validation, save, and Calculate & submit for review. The teacher may only act on active assigned offerings. The source is in main and the admin-data Edge Function is deployed as version 11; the Next.js frontend still requires a successful Vercel build/deployment and end-to-end verification before this can be called live in production.
3. **Course grading:** the database calculator aggregates each assessment category by obtained/max marks, multiplies by its configured weight, applies configured rounding, and maps the total to exactly one active grade band. The active demo scheme is 10/10/30/50; its current 4.00 grade scale is explicitly illustrative. This is implemented course-level grading, not an approved university-wide grading regulation.
4. **Semester aggregation/publication:** existing published semester snapshots can be displayed to students. Automated SGPA/CGPA aggregation, semester-batch approval, and publication remain incomplete. Do not claim semester results are generated end to end.
5. **Institutional policy decisions:** repeated-course/improvement, failed-course contribution to CGPA, absent/excused handling, credit eligibility, withdrawals, and official rounding rules still require university approval. Tests must use the active database policy fixture and must not invent institutional rules.

## 2. Test environments and roles

### Environments

- **Local integration:** Next.js application plus a clean local Supabase project with all current migrations applied.
- **Shared QA/staging:** isolated Supabase project, isolated Vercel preview deployment, synthetic data only.
- **Production smoke:** read-only checks and explicitly authorized, reversible tests only. Never generate test marks or student accounts in the live university roster without approval.

### Required test accounts and fixture data

Prepare unique test identities for:

- One active super administrator.
- One department administrator for Department A and one for Department B.
- One exam controller (scoped and, if supported, global).
- One teacher assigned to Offering A, one teacher assigned to Offering B, and one unassigned teacher.
- Two students in the same department/program but different student IDs.
- One student in another department/program.
- One inactive profile, one inactive role, and one account with no active application role.

Prepare at least two academic sessions, multiple semester definitions, two active academic terms, courses with different credit hours, offerings with distinct teachers, and enrollments that cover both valid and invalid association cases. Use synthetic email addresses and never use production student information.

For the currently configured 100-mark scheme, the demo weights are 10% assignment, 10% class test, 30% midterm, and 50% final. A deterministic smoke fixture such as 8/10, 9/10, 24/30, and 40/50 should produce 81/100 under that scheme. Confirm the active scheme and category definitions from the database before asserting this value.

## 3. Functional test cases

For every case, capture the tester, build/commit, browser, test data IDs, actual result, pass/fail, and evidence. Do not use a real student record as a negative-test target.

### 3.1 Authentication, session, and navigation

| ID | Priority | Test and steps | Expected result |
|---|---|---|---|
| AUTH-01 | P0 | Sign in with valid credentials for each supported role. | User lands in the permitted portal: admin, teacher, or student. |
| AUTH-02 | P1 | Submit empty email/password; submit malformed email; submit an incorrect password. | Browser validation or a clear field/form error appears; no session is created. |
| AUTH-03 | P0 | Sign in with an inactive profile, inactive role, or account without an active role. | Protected routes remain inaccessible; user receives a safe, understandable denial. |
| AUTH-04 | P0 | From admin, student, and teacher portals, activate Sign out. Then use browser Back and directly reopen a protected URL. | Session is cleared and the user returns to /login; protected content does not reappear from cached navigation. |
| AUTH-05 | P0 | Open /admin/*, /student/dashboard, and /teacher/dashboard while signed out; then sign in as the wrong role and retry. | Server-side route guards redirect or deny access. Hiding a link is not considered authorization. |
| AUTH-06 | P1 | Expire/revoke a session in staging, then refresh a protected page and invoke an Edge Function. | The app returns to login or an explicit session error; no stale privileged action succeeds. |
| AUTH-07 | P1 | Use Tab, Shift+Tab, Enter, and Space across the sidebar, mobile menu, and sign-out control. | Focus order is logical; controls activate using the keyboard; focus remains visible. |
| AUTH-08 | P1 | Open the mobile admin menu, press Escape, select a route, and use the close control. | Dialog closes correctly, focus returns to the opener, and route navigation works. |

### 3.2 Academic structure and record management

| ID | Priority | Test and steps | Expected result |
|---|---|---|---|
| ADM-01 | P1 | Create, list, edit, search, deactivate, and reactivate a department. Try a duplicate department code and blank required fields. | Valid changes persist; duplicates/invalid data are rejected with field-specific feedback; deactivation preserves historical links. |
| ADM-02 | P1 | Create a program linked to a department. Try a missing department, duplicate code, zero/negative duration, and zero/negative semester count. | Only valid program data is stored; invalid numeric values and duplicate codes are rejected. |
| ADM-03 | P1 | Create sessions with valid dates, reversed dates, missing optional dates, and overlapping sessions. | Required/optional date behavior matches the approved rules; end-before-start is rejected; overlap behavior is documented. |
| ADM-04 | P1 | Create semester definitions for two programs; test duplicate sequence numbers, gaps, and out-of-order values. | Each definition belongs to the selected program; sequence ordering is stable and duplicate rules are enforced. |
| ADM-05 | P1 | Create academic terms with valid program/session/semester combinations, then deliberately mix a semester from another program. | Invalid cross-program combinations are rejected; active-term lookups return only the intended program/session. |
| PEOPLE-01 | P0 | Provision a student with valid name, email, student number, department, program, and intake session. Inspect Auth, profile, role, student record, and enrollments. | One login/profile/role/student record is created and the student is enrolled only in active offerings for the selected program/session. |
| PEOPLE-02 | P1 | Provision a teacher with a valid department and unique teacher number. | Auth identity, profile, teacher role, and teacher record are linked; the account can sign in to the teacher portal. |
| PEOPLE-03 | P1 | Retry provisioning with an existing email, duplicate student/teacher number, invalid email, short ID, missing department, mismatched program/department, and invalid session. | Each invalid case is rejected without creating duplicate or orphan records. |
| PEOPLE-04 | P0 | Force a provisioning failure after Auth user creation in a disposable test project (for example, trigger a controlled database constraint failure). | The operation rolls back/compensates or clearly records a recoverable incomplete state; no silent orphan identity is left behind. |
| PEOPLE-05 | P1 | Deactivate and reactivate a student and a teacher. Check sign-in, role status, marks, enrollments, and prior results. | Inactive access is denied; existing academic history is retained; reactivation restores only the intended access. |

### 3.3 Courses, offerings, teachers, and assessments

| ID | Priority | Test and steps | Expected result |
|---|---|---|---|
| COURSE-01 | P1 | Create/edit a course with valid program, unique code, title, and credit hours. Try duplicate code, blank title, zero/negative credits. | Course validation is enforced and related records continue to resolve. |
| COURSE-02 | P1 | Create an offering with course, department, program, term, assessment scheme, grading policy, and section. Try mismatched course/program/term combinations. | Offering is linked to the correct academic context; invalid relations are rejected. |
| COURSE-03 | P1 | Assign a teacher to an offering; assign a second teacher; retry the same assignment. | The assigned teacher sees the offering; duplicate assignment is idempotent or rejected without duplicate rows. |
| COURSE-04 | P1 | Deactivate a course, offering, and teacher assignment after enrollments/marks exist. | New activity is blocked according to status rules; historical marks/results remain readable to authorized roles. |
| ASM-01 | P0 | Activate an assessment scheme whose category weights total 100%; attempt totals of 99.99% and 100.01%, duplicate categories, and missing required categories. | Only a valid scheme is accepted/activatable; active scheme version is identifiable. |
| ASM-02 | P1 | Add multiple assessments inside one category (for example, two assignments) and verify their combined category treatment. | Category aggregation follows the documented institutional rule; no assessment is silently dropped. |
| ASM-03 | P1 | Create an assessment with valid name, category, offering, maximum marks, and date. Try zero/negative maximum, missing category, and category from another scheme. | Invalid maximums and unrelated category/offering combinations are rejected. |

### 3.4 Marks entry and result workflow

| ID | Priority | Test and steps | Expected result |
|---|---|---|---|
| MARK-01 | P0 | Enter zero, a decimal mark, and the exact maximum mark for a valid enrolled student/assessment. Save, refresh, and reopen. | Values persist exactly to the supported precision and display consistently. |
| MARK-02 | P0 | Enter a negative number, a value above the maximum, blank text, non-numeric input, and an unusually long decimal. | Invalid values are rejected; blank/missing stays distinct from zero; rounding/precision follows the database rule. |
| MARK-03 | P1 | Save a mark for pending, present, absent, and excused statuses. | Status and numeric-mark requirements are enforced; absent/excused are not silently treated as zero without an approved policy. |
| MARK-04 | P0 | Pair an enrollment from Offering A with an assessment from Offering B and attempt to save. | The database/function rejects the mismatch; no mark row is written. |
| MARK-05 | P0 | Try to update marks after the course result is submitted, approved, published, or locked. | Ordinary mark updates are blocked at the server/database layer. |
| MARK-06 | P1 | Save two changes rapidly for the same student/assessment from two browser sessions. | Unique enrollment/assessment constraint prevents duplicate marks; conflict behavior is clear and auditable. |
| MARK-07 | P1 | Search marks by student ID/name and course; test no match, partial match, special characters, and large lists. | Filtering is stable, does not execute user input as code, and does not cause horizontal page overflow. |
| RESULT-01 | P0 | Process an offering with one required mark missing or unresolved. | Result calculation is blocked as incomplete; no partial official result is submitted. |
| RESULT-02 | P0 | Process a complete fixture using the active 10/10/30/50 scheme and compare the weighted result with an independent calculation. | Course total matches the active scheme and database calculation exactly, including precision/rounding rules. |
| RESULT-03 | P0 | Test values immediately below, exactly on, and immediately above each configured grade-rule boundary, including the terminal maximum mark. | Grade mapping follows the active, versioned database policy; no gaps, overlaps, or off-by-one errors. |
| RESULT-04 | P1 | Process the same offering twice and retry after a network timeout. | Operation is idempotent or creates an explicitly versioned revision; duplicate active result rows are not created silently. |
| RESULT-05 | P0 | Submit a valid course result, then attempt unauthorized submission and approval as student, unassigned teacher, and wrong department admin. | Only the authorized actor can advance the result state; client-supplied grade/points are ignored. |
| RESULT-06 | P1 | Approve a result in an eligible state, then attempt approval from an invalid state and repeat approval. | State transitions are enforced and repeated approval does not corrupt history. |
| RESULT-07 | P0 / gap | Verify semester aggregation, SGPA/CGPA snapshot creation, approval, publication, and student visibility. | Block release until an explicit semester aggregation/publication action exists and its formulas, permissions, audit trail, and policy versions are approved. |
| RESULT-08 | P0 | Test failed, non-credit, repeated, withdrawn, absent, and excused course attempts. | Results remain incomplete or follow only formally approved repeat/absence/credit policies; no invented policy is used. |

### 3.5 Student and teacher portals, privacy, and reporting

| ID | Priority | Test and steps | Expected result |
|---|---|---|---|
| PORTAL-01 | P0 | Sign in as Student A and request own published results; alter IDs in URLs/requests to Student B. | Only Student A's published results are returned. |
| PORTAL-02 | P0 | Attempt to read draft, submitted, under-review, or unapproved results as a student. | Unpublished results are not returned by UI, Edge Function, RPC, or direct Data API access. |
| PORTAL-03 | P1 | Verify legacy RPS marks shown for a linked student; compare with source component values. | Legacy marks remain component-level historical data and are not recalculated into modern SGPA/CGPA. |
| PORTAL-04 | P0 | Sign in as a teacher assigned to Offering A; try to infer/read Offering B and its marks. | The teacher sees only authorized assigned offerings/rosters. |
| PORTAL-05 | P0 | Sign in as the assigned teacher, open an editable assigned offering (for the demo account use CSE-311 or CSE-321), set one student's assessment status to Present, enter a valid mark, save, and refresh. | The mark persists and is shown on reload. A mark outside the assessment maximum, a mismatched assessment/enrollment, an unassigned offering, or a locked result is rejected by the server/database. |
| PORTAL-06 | P1 | Review reports for counts and status changes after create/deactivate/publish operations. | Dashboard/report counts match database truth and do not include draft/legacy data in the wrong category. |
| ROLE-01 | P0 | Sign in as Super Administrator, Department Administrator, Examination Controller, Teacher, and Student; inspect direct URL access and visible navigation. | Each role lands in its own workspace and cannot gain permission by changing a URL or hiding/showing a client-side control. |
| ROLE-02 | P0 | Sign in as a Department Administrator; list and mutate students, teachers, courses, offerings, assessments, and draft marks in the assigned department, then try another department ID. | Own-department actions succeed; cross-department reads/writes and account provisioning are rejected. Global sessions, grading policy, and department administration remain unavailable. |
| ROLE-03 | P0 | Sign in as a global Examination Controller; inspect submitted course results and approve one. Try to create/edit an academic record, save marks, change grade rules, assign a teacher, or calculate a result. | The controller can read and approve eligible submitted/under-review course results, but every unrelated write/calculation action is denied by Edge Function and RLS/RPC. |
| ROLE-04 | P0 | Sign in as a teacher assigned to Offering A; save a mark, attempt to access Offering B, then attempt to submit an offering with missing required marks. | The teacher can edit only their assigned active offering. Cross-offering writes are rejected. Processing remains blocked until required marks are complete; submitted marks become locked. |
| ROLE-05 | P0 | Deactivate an account or role while its session remains open; retry teacher save, result submission, controller approval, or department write. | Active-status checks fail closed; no stale privileged action is accepted. |
| SEC-01 | P0 | Call every Edge Function without JWT, with expired JWT, and with a valid token for the wrong role. | Requests fail closed with expected 401/403; no data is returned. |
| SEC-02 | P0 | Verify browser bundle, source maps, network calls, and Vercel environment settings for service-role/secret keys. | No service-role key or secret credential is exposed to the browser or NEXT_PUBLIC_* variables. |
| SEC-03 | P0 | Attempt cross-department list, update, provisioning, mark entry, and approval operations. | Database and server authorization enforce department scope regardless of UI state. |
| SEC-04 | P1 | Submit malformed JSON, unsupported action/resource, missing IDs, oversized fields, HTML/script strings, and SQL-like strings. | Input is validated; no injection or unhandled 500 occurs; errors do not reveal secrets or internal stack traces. |
| SEC-05 | P1 | Verify audit records for provisioning, status changes, mark changes, processing, approval, and correction. | Actor, timestamp, affected record, prior/new state, and reason (where required) are attributable. |

## 4. Cross-browser compatibility matrix

Run the same high-priority scenarios in the latest stable release and one previous major release where practical.

| Browser / engine | Desktop | Mobile / tablet | High-risk checks |
|---|---|---|---|
| Chrome / Chromium | Windows, macOS, Linux | Android Chrome | Forms, sticky header, drawer, tables, clipboard, auth refresh, focus ring |
| Firefox / Gecko | Windows, macOS, Linux | Android Firefox where available | Flex/grid sizing, date inputs, focus behavior, scrollable tables, form validation |
| Safari / WebKit | macOS Safari | iPhone/iPad Safari | Dynamic viewport height, safe areas, keyboard resize, sticky/backdrop rendering, cookie/session refresh |
| Edge / Chromium | Windows | Android Edge if in target audience | Same Chromium checks plus download/print behavior |

| ID | Priority | Test and steps | Expected result |
|---|---|---|---|
| BROWSER-01 | P1 | Run login, navigation, provisioning forms, mark entry, and logout in Chrome, Firefox, Safari, and Edge. | No browser-specific functional failure or unhandled console error. |
| BROWSER-02 | P1 | Compare focus indicators, dialogs, sticky headers, backdrop blur, date/number inputs, and overflow tables. | CSS remains usable; controls are not hidden or clipped. |
| BROWSER-03 | P1 | Test Supabase cookie/session persistence across refresh, direct route, and browser restart where the browser supports persistence. | Auth behavior is consistent and unauthorized stale sessions are rejected. |
| BROWSER-04 | P2 | Test printing, copy-credentials, clipboard denial, and blocked third-party storage settings. | Graceful fallback or actionable feedback appears; the application does not crash. |

**Current automation baseline:** Playwright currently configures Desktop Chrome only. Add Chromium, Firefox, WebKit, and mobile device projects in CI after the corresponding Playwright browsers are installed.

## 5. Mobile responsiveness audit and test cases

Target viewport widths: 320, 360, 375, 390, 414, 430, 768, 820, 1024, and 1280 CSS pixels. Test portrait and landscape on real devices where available.

| ID | Priority | Device / steps | Expected result |
|---|---|---|---|
| MOBILE-01 | P1 | iPhone SE-class width (320–375px): open admin menu, navigate, inspect header and sign-out. | No clipped controls; drawer fits viewport; sign-out remains reachable. |
| MOBILE-02 | P1 | iPhone Safari: focus email/password and numeric mark inputs to open the virtual keyboard; scroll to submit/save. | Keyboard does not cover the active field or action; layout returns to the correct scroll position. |
| MOBILE-03 | P1 | iPhone Safari: rotate portrait/landscape, open and close drawer, and use browser back. | Viewport recalculates; overlay does not remain stuck; page remains scrollable. |
| MOBILE-04 | P1 | Android Chrome at 360–412px: test login, long student names, email wrapping, and action buttons. | Text wraps without overlapping; fields and buttons remain usable. |
| MOBILE-05 | P1 | Tablet at 768px and 820px: inspect navigation breakpoint, forms, cards, and result tables. | Mobile/tablet navigation is deliberate; content does not become an awkward narrow desktop layout. |
| MOBILE-06 | P1 | 1024px width: verify transition to fixed desktop sidebar and content offset. | Sidebar and content do not overlap; sticky header is not obscured. |
| MOBILE-07 | P1 | Open legacy result/mark tables on phone and tablet; horizontally scroll the table only. | Table remains readable and the entire page does not gain unintended horizontal overflow. |
| MOBILE-08 | P1 | Use touch only: open/close menus, select options, submit forms, save marks, and sign out. | Targets meet WCAG 2.2 2.5.8 minimum target sizing/spacing and are comfortably tappable. |
| MOBILE-09 | P2 | Enable larger system text / browser zoom and test 200% text scaling. | No clipped labels, overlapping navigation, or lost actions. |

### CSS and JavaScript fixes to apply if tests fail

- Use the dynamic viewport (100dvh) with a 100vh fallback for full-height screens; account for iOS browser chrome and safe-area insets where a control sits against a screen edge.
- Keep fixed/sticky elements from covering focused controls; test scroll-margin-top for page anchors and sticky-header overlap.
- Keep tables inside overflow-x-auto containers; do not apply overflow-x: hidden to the entire page to conceal layout defects.
- Prefer CSS grid/flex wrapping and min-width: 0 on text-bearing flex children; test long names, IDs, and emails.
- Verify drawer keyboard handling, focus restoration, and body-scroll restoration after close, route change, and browser back.
- Guard clipboard access and other browser APIs; provide a visible fallback when permission is denied or the API is unavailable.

## 6. Accessibility test plan — WCAG 2.2 AA

Use automated axe-core scanning plus manual keyboard and screen-reader testing. Automated tools do not establish WCAG conformance by themselves.

| ID | WCAG focus | Test and steps | Expected result |
|---|---|---|---|
| A11Y-01 | 1.3.1, 2.4.6 | Inspect page landmarks and headings on login, admin, student, and teacher pages. | One clear page-level h1; meaningful heading nesting; named navigation landmarks; main content landmark. |
| A11Y-02 | 1.1.1, 4.1.2 | Inspect every informative image/icon/control with a screen reader and accessibility tree. | Informative images have concise alt text; decorative icons are hidden from assistive technology; icon-only controls have accessible names. |
| A11Y-03 | 1.3.1, 3.3.2 | Inspect every input/select/textarea, search field, marks cell, and error. | Each control has a persistent programmatic label; placeholder text is not the only label; grouped fields have instructions. |
| A11Y-04 | 1.4.3 | Measure text/background pairs in default, hover, focus, disabled, error, badge, and table states. | Normal text is at least 4.5:1; large text is at least 3:1. Do not convey state using color alone. |
| A11Y-05 | 1.4.11 | Measure borders, control boundaries, charts, status indicators, and focus indicators. | Required non-text UI components and graphical objects have at least 3:1 contrast against adjacent colors. |
| A11Y-06 | 2.1.1, 2.1.2, 2.4.3, 2.4.7 | Complete all portal workflows with keyboard only; inspect Tab order and focus visibility. | All functionality is keyboard operable, focus is visible, and no keyboard trap occurs. |
| A11Y-07 | 2.4.11 | Open mobile drawer and focus controls near the top/bottom of the viewport and under sticky headers. | Focused controls are not entirely hidden by sticky headers, dialogs, or overlays. |
| A11Y-08 | 2.5.8 | Measure touch/click targets and spacing for menu, close, refresh, save, status, and sign-out controls. | Target is at least 24×24 CSS px or meets the WCAG spacing exception; aim for 44×44 for primary touch controls. |
| A11Y-09 | 1.4.10, 1.4.12 | Reflow at 320 CSS px and text spacing override (line height 1.5×, paragraph spacing 2×, letter spacing 0.12× font size, word spacing 0.16× font size). | No loss of content/functionality except two-dimensional data tables; no overlap or clipping. |
| A11Y-10 | 3.3.1, 3.3.3, 4.1.3 | Submit invalid forms and trigger loading/success/error states. | Errors identify the affected field and correction; status messages are announced without moving focus unexpectedly. |
| A11Y-11 | 2.2.2, 2.3.3 | Enable reduced-motion and inspect loading indicators, transitions, and hover animations. | Non-essential movement is removed or reduced; no flashing content. |
| A11Y-12 | 1.3.1, 1.4.3 | Read data tables with NVDA/Firefox, NVDA/Chrome, and VoiceOver/Safari. | Header cells are associated with data cells; row/column context is understandable; horizontal scrolling is keyboard accessible. |

### Source-code review findings and changes in this commit

**Confirmed before this update**

- The active admin, student, and teacher headers did not render a logout control. A server-side signOutAction existed, but the older dashboard component using it was not the active admin shell.
- The admin nav had no accessible name, despite an existing Playwright test expecting “Main navigation”.
- Admin search inputs and the marks-entry input relied on placeholders/visual context rather than explicit accessible names.
- Several dynamic data-table headers did not declare scope="col".
- The mobile admin drawer had no dialog semantics, Escape handling, focus trap, or focus restoration.
- The login primary button used white text on #4ab875 (approximately **2.50:1** contrast), below 4.5:1. The login eyebrow green #4a9d68 is approximately **3.33:1** against white. The decorative wordmark green #48b875 is approximately **2.50:1** against white.
- text-slate-400 (#94a3b8) is approximately **2.56:1** against white and should not be used for normal-sized text on white cards.
- The sampled active portal components have a sensible h1 → h2 → h3 structure. No meaningful raster images appear in the sampled active portal views; icons are decorative rather than content images.

**Changes made with this plan**

- Added one shared sign-out control to admin, student, and teacher portals.
- Named the admin navigation landmark and added dialog semantics, Escape handling, focus trapping, focus restoration, and body-scroll restoration to the mobile drawer.
- Added accessible names to admin search/marks/assignment controls and column scope to the inspected tables.
- Added a global visible keyboard focus style, forced-colors focus support, dynamic viewport-height support, and reduced-motion handling.
- Strengthened login focus indication and changed the primary login button/brand text to an accessible dark green.
- Added role-specific admin routing/navigation for Department Administrators and Examination Controllers.
- Implemented assigned-teacher roster and marks entry, server-side mark validation, assigned-offering checks, result-state locking, and teacher Calculate & submit.
- Added Edge Function permission checks for department-scoped data, student/teacher provisioning, mark entry, result submission, and course-result approval.
- Tightened database helpers/RLS/RPCs so inactive roles fail closed, teachers calculate/submit only their assigned offerings, and Examination Controllers approve but cannot make academic-record or marks changes.
- Corrected demo role assignments for department@scholix.demo and controller@scholix.demo.

**Remaining manual audit work**

- Scan all routes with axe-core/WAVE and verify every contrast pair, including badges, muted text, placeholders, error states, and hover states. This source review is not a complete site-wide contrast certification.
- Ensure all remaining text-slate-400, text-slate-300, and custom light-green text classes are replaced or paired with sufficient contrast where they convey information.
- Verify every table, chart, SVG, modal, and dynamic status message with NVDA and VoiceOver.
- Verify focus order and target size on real iOS/Android devices, not only a responsive desktop emulator.

## 7. Performance and load testing

### Proposed acceptance budgets

These are QA targets, not current measured results:

- Core Web Vitals at the 75th percentile: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.
- Normal read endpoints: p95 ≤ 500 ms under the agreed staging load.
- Normal write/provision actions: p95 ≤ 1.0 s excluding email/provider delays and deliberately expensive result calculations.
- Sustained application/API error rate below 1% during the agreed load profile; zero unhandled data-integrity errors.
- No lost or duplicated marks, enrollments, account roles, or result records under retries/concurrency.

| ID | Priority | Load test and steps | Expected result |
|---|---|---|---|
| PERF-01 | P1 | Measure login, dashboard, student results, teacher workspace, admin module lists, and mark entry with cold and warm caches. | Budgets above are met; record LCP/INP/CLS and API timings separately. |
| PERF-02 | P1 | Ramp staging traffic from 10 to 25, 50, then 100 concurrent authenticated users over 10–15 minutes. | No data leakage, runaway errors, or sustained latency growth. |
| PERF-03 | P1 | Load large admin lists with 500, 2,000, and 10,000 synthetic records where supported; search/filter and paginate/scroll. | UI remains responsive; queries are bounded; browser memory remains stable. |
| PERF-04 | P1 | Load a large offering with many enrollments and assessments; open marks table and process an offering. | Processing completes within an agreed service objective; no request timeout or partial duplicate results. |
| PERF-05 | P0 | Submit concurrent saves for the same enrollment/assessment and retry requests after simulated timeout. | Unique constraints/idempotency preserve one authoritative value and an attributable update history. |
| PERF-06 | P1 | Test burst and steady Edge Function invocation against admin list, provision account, student results, and teacher workspace. | Cold starts and concurrency do not cause 5xx spikes; rate limits and safe errors behave predictably. |
| PERF-07 | P2 | Run a 60-minute soak at the expected peak load and monitor Vercel/Supabase resource and error metrics. | No memory leak, connection exhaustion, growing queue, or degradation over time. |
| PERF-08 | P1 | Simulate database latency, Edge Function timeout, network loss, and browser refresh during writes. | UI reports retryable failure; writes are not duplicated; stale partial state is not shown as saved. |

### Load profile and safety

- Use a dedicated staging database with generated identities and marks.
- Seed a representative distribution: departments, programs, sessions, semester terms, courses, offerings, teachers, students, enrollments, four assessment categories, and historical result snapshots.
- Do not run 100-user stress or destructive fault injection against production.
- Record Vercel function duration/error logs, Supabase Edge Function logs, Postgres query latency, connection utilization, and browser performance traces for each run.

## 8. Test execution commands and tooling

The repository currently includes Vitest and Playwright scaffolding. The Playwright configuration currently selects Desktop Chrome; browser projects should be enabled in CI before the compatibility matrix is considered automated.

Commands:

- npm run typecheck
- npm run lint
- npm test
- npx playwright install --with-deps chromium firefox webkit
- npm run test:e2e

Recommended QA tooling:

- Playwright for functional flows, viewport checks, browser automation, and trace capture.
- axe-core integration for automated accessibility scanning, followed by manual WCAG checks.
- NVDA with Firefox/Chrome and VoiceOver with Safari for screen-reader validation.
- Lighthouse/WebPageTest plus field Core Web Vitals for performance.
- k6 or Artillery for staged HTTP/API load tests; use synthetic data and controlled concurrency.

## 9. Entry and exit criteria

**Entry:** staging build is deployed; migrations are applied; required roles and synthetic fixtures exist; active assessment/grading policies are captured; QA has a rollback/reset path.

**Exit:** all P0 cases pass; all P1 failures are fixed or explicitly accepted with an owner and date; no unresolved critical/high security or data-integrity issue remains; accessibility manual checks are complete; cross-browser/mobile smoke suite passes; performance budgets are met under the agreed profile; and evidence is attached to the release record.

**Release blockers:** Next.js frontend build/deployment and teacher grading end-to-end verification; no supported semester aggregate/SGPA/CGPA publication flow; unresolved institutional repeat/absence/excused/credit/rounding policies; any cross-department or cross-student data exposure; any unreviewed published-result mutation. The role-specific implementation is present in the current code and Supabase deployment, but it must pass ROLE-01 through ROLE-05 and the release smoke suite.
