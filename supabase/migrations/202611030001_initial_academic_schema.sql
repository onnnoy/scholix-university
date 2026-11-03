-- Scholix: initial academic domain, role model, and database security baseline.
-- This migration creates the data model only. Official grading/repeat policies
-- must be configured by the institution before calculating or publishing results.

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'super_admin',
  'department_admin',
  'teacher',
  'exam_controller',
  'student'
);

create type public.account_status as enum ('active', 'suspended', 'disabled');
create type public.record_status as enum ('active', 'inactive', 'archived');
create type public.term_status as enum ('planning', 'active', 'completed', 'archived');
create type public.enrollment_status as enum ('active', 'withdrawn', 'completed');
create type public.assessment_category as enum ('assignment', 'class_test', 'midterm', 'final');
create type public.assessment_status as enum ('draft', 'active', 'cancelled');
create type public.mark_status as enum ('pending', 'present', 'absent', 'excused');
create type public.result_status as enum ('draft', 'submitted', 'under_review', 'approved', 'published', 'locked');
create type public.repeat_course_policy as enum ('latest_attempt', 'highest_grade', 'first_attempt', 'count_all_attempts', 'replace_previous');
create type public.missing_mark_policy as enum ('incomplete', 'treat_as_zero', 'manual_resolution');

-- Identity and authorization -------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  department_id uuid,
  is_active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint department_admin_requires_scope check (role <> 'department_admin' or department_id is not null)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles
  add constraint user_roles_department_fk foreign key (department_id) references public.departments(id) on delete restrict;

create unique index user_roles_global_role_unique
  on public.user_roles(user_id, role) where department_id is null and is_active;
create unique index user_roles_scoped_role_unique
  on public.user_roles(user_id, role, department_id) where department_id is not null and is_active;
create index user_roles_user_active_idx on public.user_roles(user_id, is_active);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  name text not null,
  code text not null,
  duration_years numeric(4,1) check (duration_years is null or duration_years > 0),
  total_semesters smallint check (total_semesters is null or total_semesters > 0),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, code),
  unique (id, department_id)
);

create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date,
  ends_on date,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint academic_session_date_order check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create table public.semester_definitions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  name text not null,
  sequence_number smallint not null check (sequence_number > 0),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (program_id, name),
  unique (program_id, sequence_number),
  unique (id, program_id)
);

-- An academic term is an actual delivery period. It is deliberately distinct
-- from the student's original intake session and reusable semester definition.
create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  semester_definition_id uuid not null,
  name text,
  starts_on date,
  ends_on date,
  status public.term_status not null default 'planning',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_term_semester_fk foreign key (semester_definition_id, program_id)
    references public.semester_definitions(id, program_id) on delete restrict,
  constraint academic_term_date_order check (starts_on is null or ends_on is null or ends_on >= starts_on),
  unique (academic_session_id, semester_definition_id),
  unique (id, program_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete restrict,
  student_number text not null unique,
  full_name text not null,
  email text,
  department_id uuid not null,
  program_id uuid not null,
  intake_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  academic_status text not null default 'active' check (academic_status in ('active', 'graduated', 'suspended', 'withdrawn', 'dismissed')),
  enrollment_date date,
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_program_department_fk foreign key (program_id, department_id)
    references public.programs(id, department_id) on delete restrict,
  unique (id, program_id)
);

-- A student's current program is shown on students; this table preserves each
-- effective program/intake assignment when the student transfers or changes cohort.
create table public.student_program_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  department_id uuid not null,
  program_id uuid not null,
  intake_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  valid_from timestamptz not null default clock_timestamp(),
  valid_to timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (program_id, department_id) references public.programs(id, department_id) on delete restrict,
  check (valid_to is null or valid_to >= valid_from)
);

create unique index student_program_history_one_current_idx
  on public.student_program_history(student_id) where valid_to is null;
create index student_program_history_student_timeline_idx
  on public.student_program_history(student_id, valid_from desc);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete restrict,
  teacher_number text not null unique,
  full_name text not null,
  email text,
  department_id uuid not null references public.departments(id) on delete restrict,
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Courses can be reused across programs in the same department.
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  course_code text not null,
  title text not null,
  description text,
  credit_hours numeric(5,2) not null default 0 check (credit_hours >= 0),
  is_credit_bearing boolean not null default true,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, course_code),
  unique (id, department_id)
);

create table public.program_courses (
  program_id uuid not null,
  course_id uuid not null,
  department_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (program_id, course_id),
  unique (program_id, course_id, department_id),
  foreign key (program_id, department_id) references public.programs(id, department_id) on delete restrict,
  foreign key (course_id, department_id) references public.courses(id, department_id) on delete restrict
);

-- Assessment configuration ---------------------------------------------------

create table public.assessment_schemes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1 check (version > 0),
  description text,
  status public.record_status not null default 'inactive',
  activated_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table public.assessment_scheme_categories (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.assessment_schemes(id) on delete cascade,
  category public.assessment_category not null,
  weight numeric(7,3) not null check (weight >= 0 and weight <= 100),
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (scheme_id, category),
  unique (scheme_id, category, id)
);

create table public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  department_id uuid not null,
  program_id uuid not null,
  academic_term_id uuid not null,
  assessment_scheme_id uuid not null references public.assessment_schemes(id) on delete restrict,
  section_name text not null default 'A',
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_id, department_id) references public.courses(id, department_id) on delete restrict,
  foreign key (program_id, department_id) references public.programs(id, department_id) on delete restrict,
  foreign key (program_id, course_id, department_id) references public.program_courses(program_id, course_id, department_id) on delete restrict,
  foreign key (academic_term_id, program_id) references public.academic_terms(id, program_id) on delete restrict,
  unique (course_id, academic_term_id, section_name),
  unique (id, assessment_scheme_id),
  unique (id, program_id)
);

create table public.offering_teachers (
  course_offering_id uuid not null references public.course_offerings(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (course_offering_id, teacher_id)
);

create or replace function public.validate_offering_teacher_department()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.course_offerings o
    join public.teachers t on t.id = new.teacher_id
    where o.id = new.course_offering_id and o.department_id = t.department_id
  ) then
    raise exception 'A teacher can only be assigned to a course offering in the same department.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger offering_teacher_department_check
  before insert or update on public.offering_teachers
  for each row execute function public.validate_offering_teacher_department();

create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  program_id uuid not null,
  course_offering_id uuid not null,
  attempt_number smallint not null default 1 check (attempt_number > 0),
  status public.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  foreign key (course_offering_id, program_id) references public.course_offerings(id, program_id) on delete restrict,
  unique (student_id, course_offering_id),
  unique (id, course_offering_id)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_offering_id uuid not null,
  assessment_scheme_id uuid not null,
  category public.assessment_category not null,
  name text not null,
  maximum_marks numeric(9,3) not null check (maximum_marks > 0),
  assessment_date date,
  is_required boolean not null default true,
  status public.assessment_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_offering_id, assessment_scheme_id)
    references public.course_offerings(id, assessment_scheme_id) on delete restrict,
  foreign key (assessment_scheme_id, category)
    references public.assessment_scheme_categories(scheme_id, category) on delete restrict,
  unique (id, course_offering_id)
);

create table public.student_marks (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_offering_id uuid not null,
  assessment_id uuid not null,
  marks_obtained numeric(9,3),
  status public.mark_status not null default 'pending',
  entered_by uuid references public.profiles(id) on delete set null,
  last_modified_by uuid references public.profiles(id) on delete set null,
  entered_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (enrollment_id, course_offering_id)
    references public.course_enrollments(id, course_offering_id) on delete restrict,
  foreign key (assessment_id, course_offering_id)
    references public.assessments(id, course_offering_id) on delete restrict,
  check (marks_obtained is null or marks_obtained >= 0),
  check (status <> 'present' or marks_obtained is not null),
  unique (enrollment_id, assessment_id)
);

-- Grading and calculation policy versions ----------------------------------

create table public.grading_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null check (version > 0),
  department_id uuid references public.departments(id) on delete restrict,
  program_id uuid,
  maximum_gpa numeric(5,3) not null check (maximum_gpa > 0),
  activated_at timestamptz,
  decimal_places smallint not null default 2 check (decimal_places between 0 and 4),
  rounding_mode text not null default 'half_up' check (rounding_mode in ('half_up', 'half_even', 'down', 'up')),
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, version),
  check (program_id is null or department_id is not null),
  foreign key (program_id, department_id) references public.programs(id, department_id) on delete restrict
);

create table public.grade_rules (
  id uuid primary key default gen_random_uuid(),
  grading_policy_id uuid not null references public.grading_policies(id) on delete cascade,
  minimum_mark numeric(7,3) not null check (minimum_mark >= 0 and minimum_mark <= 100),
  maximum_mark numeric(7,3) not null check (maximum_mark >= 0 and maximum_mark <= 100),
  letter_grade text not null,
  grade_point numeric(5,3) not null check (grade_point >= 0),
  is_passing boolean not null default true,
  created_at timestamptz not null default now(),
  check (maximum_mark > minimum_mark),
  unique (grading_policy_id, letter_grade)
);

create table public.result_calculation_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null check (version > 0),
  department_id uuid references public.departments(id) on delete restrict,
  program_id uuid,
  repeat_course_policy public.repeat_course_policy not null,
  activated_at timestamptz,
  absent_mark_policy public.missing_mark_policy not null default 'incomplete',
  excused_mark_policy public.missing_mark_policy not null default 'manual_resolution',
  exclude_non_credit_courses boolean not null default true,
  decimal_places smallint not null default 2 check (decimal_places between 0 and 4),
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, version),
  check (program_id is null or department_id is not null),
  foreign key (program_id, department_id) references public.programs(id, department_id) on delete restrict
);

create table public.course_equivalency_groups (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (program_id, name)
);

create table public.course_equivalencies (
  group_id uuid not null references public.course_equivalency_groups(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (group_id, course_id)
);

-- Immutable, versioned result snapshots ------------------------------------

create table public.course_results (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_offering_id uuid not null,
  revision_number integer not null default 1 check (revision_number > 0),
  supersedes_result_id uuid references public.course_results(id) on delete restrict,
  grading_policy_id uuid not null references public.grading_policies(id) on delete restrict,
  calculation_policy_id uuid not null references public.result_calculation_policies(id) on delete restrict,
  total_marks numeric(9,3) not null check (total_marks >= 0 and total_marks <= 100),
  letter_grade text not null,
  grade_point numeric(5,3) not null check (grade_point >= 0),
  credit_hours numeric(5,2) not null check (credit_hours >= 0),
  status public.result_status not null default 'draft',
  calculated_at timestamptz not null default now(),
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, course_offering_id)
    references public.course_enrollments(id, course_offering_id) on delete restrict,
  unique (enrollment_id, revision_number),
  check ((status not in ('published', 'locked')) or published_at is not null)
);

create table public.semester_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  academic_term_id uuid not null references public.academic_terms(id) on delete restrict,
  revision_number integer not null default 1 check (revision_number > 0),
  supersedes_result_id uuid references public.semester_results(id) on delete restrict,
  grading_policy_id uuid not null references public.grading_policies(id) on delete restrict,
  calculation_policy_id uuid not null references public.result_calculation_policies(id) on delete restrict,
  eligible_credits numeric(8,2) not null check (eligible_credits >= 0),
  sgpa numeric(5,3) check (sgpa is null or sgpa >= 0),
  cgpa numeric(5,3) check (cgpa is null or cgpa >= 0),
  status public.result_status not null default 'draft',
  calculated_at timestamptz not null default now(),
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, academic_term_id, revision_number),
  check ((status not in ('published', 'locked')) or published_at is not null)
);

create table public.result_publications (
  id uuid primary key default gen_random_uuid(),
  academic_term_id uuid not null references public.academic_terms(id) on delete restrict,
  publication_version integer not null default 1 check (publication_version > 0),
  published_by uuid not null references public.profiles(id) on delete restrict,
  publication_note text,
  published_at timestamptz not null default now(),
  unique (academic_term_id, publication_version)
);

create table public.result_corrections (
  id uuid primary key default gen_random_uuid(),
  course_result_id uuid references public.course_results(id) on delete restrict,
  semester_result_id uuid references public.semester_results(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reason text not null check (length(trim(reason)) >= 10),
  old_values jsonb not null,
  proposed_values jsonb not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'applied')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (num_nonnulls(course_result_id, semester_result_id) = 1)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

-- Supporting indexes ---------------------------------------------------------

create index students_department_program_idx on public.students(department_id, program_id);
create index students_intake_idx on public.students(intake_session_id);
create index teachers_department_idx on public.teachers(department_id);
create index academic_terms_program_session_idx on public.academic_terms(program_id, academic_session_id);
create index course_offerings_term_idx on public.course_offerings(academic_term_id, department_id);
create index offering_teachers_teacher_idx on public.offering_teachers(teacher_id, course_offering_id);
create index course_enrollments_offering_idx on public.course_enrollments(course_offering_id, status);
create index course_enrollments_student_idx on public.course_enrollments(student_id, course_offering_id);
create index assessments_offering_idx on public.assessments(course_offering_id, status);
create index student_marks_assessment_idx on public.student_marks(assessment_id, status);
create index course_results_enrollment_idx on public.course_results(enrollment_id, revision_number desc);
create index semester_results_student_term_idx on public.semester_results(student_id, academic_term_id, revision_number desc);
create index semester_results_status_idx on public.semester_results(status, academic_term_id);
create index audit_logs_entity_idx on public.audit_logs(entity_table, entity_id, created_at desc);

-- Profile creation and integrity guards -------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

create or replace function public.capture_student_program_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_transition_time timestamptz;
begin
  if tg_op = 'INSERT' then
    insert into public.student_program_history (student_id, department_id, program_id, intake_session_id, recorded_by)
    values (new.id, new.department_id, new.program_id, new.intake_session_id, auth.uid());
    return new;
  end if;

  if new.department_id is distinct from old.department_id
     or new.program_id is distinct from old.program_id
     or new.intake_session_id is distinct from old.intake_session_id then
    v_transition_time := clock_timestamp();
    update public.student_program_history
      set valid_to = v_transition_time
      where student_id = old.id and valid_to is null;
    insert into public.student_program_history (student_id, department_id, program_id, intake_session_id, valid_from, recorded_by)
    values (new.id, new.department_id, new.program_id, new.intake_session_id, v_transition_time, auth.uid());
  end if;
  return new;
end;
$$;

create trigger students_capture_initial_program_history
  after insert on public.students
  for each row execute function public.capture_student_program_history();

create trigger students_capture_program_history_change
  after update of department_id, program_id, intake_session_id on public.students
  for each row execute function public.capture_student_program_history();

create or replace function public.validate_course_enrollment_program()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current_program_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.student_id is distinct from old.student_id
       or new.program_id is distinct from old.program_id
       or new.course_offering_id is distinct from old.course_offering_id then
      raise exception 'A course enrollment cannot be reassigned. Create a new enrollment record.' using errcode = '23514';
    end if;
    return new;
  end if;

  select program_id into v_current_program_id from public.students where id = new.student_id;
  if not found then
    raise exception 'Student does not exist.' using errcode = '23503';
  end if;
  if v_current_program_id <> new.program_id then
    raise exception 'A student can only be newly enrolled in a course offering for their current program.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger course_enrollment_validate_program
  before insert or update on public.course_enrollments
  for each row execute function public.validate_course_enrollment_program();

create or replace function public.validate_student_mark()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_maximum numeric(9,3);
begin
  select maximum_marks into v_maximum
  from public.assessments
  where id = new.assessment_id and course_offering_id = new.course_offering_id;

  if not found then
    raise exception 'Assessment does not belong to the selected course offering.' using errcode = '23503';
  end if;

  if tg_op = 'UPDATE' then
    if new.enrollment_id is distinct from old.enrollment_id or new.course_offering_id is distinct from old.course_offering_id or new.assessment_id is distinct from old.assessment_id then
      raise exception 'A mark cannot be reassigned to another student, course offering, or assessment.' using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1 from public.course_results cr
    where cr.enrollment_id = new.enrollment_id and cr.course_offering_id = new.course_offering_id
      and cr.status in ('submitted', 'under_review', 'approved', 'published', 'locked')
  ) then
    raise exception 'Marks for a submitted or finalized course result are locked. Reopen the result through an authorized workflow before changing marks.' using errcode = '55000';
  end if;

  if new.marks_obtained is not null and new.marks_obtained > v_maximum then
    raise exception 'Obtained marks cannot exceed the assessment maximum of %.', v_maximum using errcode = '23514';
  end if;

  if new.status = 'present' and new.marks_obtained is null then
    raise exception 'Marks are required when the student is marked present.' using errcode = '23514';
  end if;

  if new.entered_at is null and new.status <> 'pending' then
    new.entered_at := now();
  end if;
  if tg_op = 'INSERT' then
    if new.entered_by is null then new.entered_by := auth.uid(); end if;
  else
    new.entered_by := old.entered_by;
  end if;
  new.last_modified_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger student_marks_validate
  before insert or update on public.student_marks
  for each row execute function public.validate_student_mark();

create or replace function public.prevent_published_result_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status in ('published', 'locked') then
    raise exception 'Published result snapshots are immutable. Use the authorized correction workflow.' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger course_results_immutable
  before update or delete on public.course_results
  for each row execute function public.prevent_published_result_mutation();

create trigger semester_results_immutable
  before update or delete on public.semester_results
  for each row execute function public.prevent_published_result_mutation();

create or replace function public.check_grade_rule_overlap()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.grade_rules r
    where r.grading_policy_id = new.grading_policy_id
      and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and numrange(r.minimum_mark, r.maximum_mark, '[)') && numrange(new.minimum_mark, new.maximum_mark, '[)')
  ) then
    raise exception 'Grade rule intervals cannot overlap within one grading policy.' using errcode = '23P01';
  end if;
  return new;
end;
$$;

create trigger grade_rules_no_overlap
  before insert or update on public.grade_rules
  for each row execute function public.check_grade_rule_overlap();

-- Activate an assessment scheme only after its configurable weights total 100%.
create or replace function public.validate_assessment_scheme_activation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
  v_total numeric(10,3);
  v_should_validate boolean := true;
begin
  if tg_op = 'UPDATE' then
    v_should_validate := old.status <> 'active';
  end if;
  if new.status = 'active' and v_should_validate then
    select count(*), coalesce(sum(weight), 0) into v_count, v_total
    from public.assessment_scheme_categories where scheme_id = new.id;
    if v_count = 0 or abs(v_total - 100) > 0.001 then
      raise exception 'An active assessment scheme must have categories whose weights total exactly 100%%.' using errcode = '23514';
    end if;
    new.activated_at := coalesce(new.activated_at, now());
  end if;
  return new;
end;
$$;

create trigger assessment_scheme_validate_activation
  before insert or update of status on public.assessment_schemes
  for each row execute function public.validate_assessment_scheme_activation();

create or replace function public.prevent_active_scheme_category_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_scheme_id uuid;
  v_locked boolean;
begin
  v_scheme_id := case when tg_op = 'DELETE' then old.scheme_id else new.scheme_id end;
  select activated_at is not null into v_locked from public.assessment_schemes where id = v_scheme_id;
  if v_locked then
    raise exception 'Activated assessment scheme categories are immutable. Create a new scheme version.' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' then
    if exists (select 1 from public.assessment_schemes where id = old.scheme_id and activated_at is not null) then
      raise exception 'Activated assessment scheme categories are immutable. Create a new scheme version.' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger assessment_scheme_categories_immutable
  before insert or update or delete on public.assessment_scheme_categories
  for each row execute function public.prevent_active_scheme_category_mutation();

create or replace function public.prevent_activated_assessment_scheme_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.activated_at is not null and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Activated assessment scheme definitions are immutable. Create a new scheme version.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger assessment_scheme_lock_activated
  before update on public.assessment_schemes
  for each row when (old.activated_at is not null)
  execute function public.prevent_activated_assessment_scheme_mutation();

create or replace function public.validate_active_grading_policy()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
  v_first numeric(7,3);
  v_last numeric(7,3);
  v_has_gap boolean;
  v_has_invalid_point boolean;
  v_should_validate boolean := true;
begin
  if tg_op = 'UPDATE' then
    v_should_validate := old.is_active = false;
  end if;
  if new.is_active and v_should_validate then
    select count(*), min(minimum_mark), max(maximum_mark)
      into v_count, v_first, v_last
      from public.grade_rules where grading_policy_id = new.id;
    if v_count = 0 or v_first > 0 or v_last < 100 then
      raise exception 'An active grading policy must cover the complete 0–100 marks range.' using errcode = '23514';
    end if;

    with ordered as (
      select minimum_mark, lag(maximum_mark) over (order by minimum_mark) as previous_max
      from public.grade_rules where grading_policy_id = new.id
    )
    select exists (select 1 from ordered where previous_max is not null and minimum_mark - previous_max > 0.001)
      into v_has_gap;
    if v_has_gap then
      raise exception 'Grade rules in an active policy cannot leave gaps in the marks range.' using errcode = '23514';
    end if;

    select exists (select 1 from public.grade_rules where grading_policy_id = new.id and grade_point > new.maximum_gpa)
      into v_has_invalid_point;
    if v_has_invalid_point then
      raise exception 'Grade points cannot exceed the policy GPA scale.' using errcode = '23514';
    end if;
    new.activated_at := coalesce(new.activated_at, now());
  end if;
  return new;
end;
$$;

create trigger grading_policy_validate_activation
  before insert or update of is_active on public.grading_policies
  for each row execute function public.validate_active_grading_policy();

create or replace function public.prevent_active_grade_rule_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_policy_id uuid;
  v_locked boolean;
begin
  v_policy_id := case when tg_op = 'DELETE' then old.grading_policy_id else new.grading_policy_id end;
  select activated_at is not null into v_locked from public.grading_policies where id = v_policy_id;
  if v_locked then
    raise exception 'Activated grading policy rules are immutable. Create a new policy version.' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' then
    if exists (select 1 from public.grading_policies where id = old.grading_policy_id and activated_at is not null) then
      raise exception 'Activated grading policy rules are immutable. Create a new policy version.' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger grade_rules_immutable_when_active
  before insert or update or delete on public.grade_rules
  for each row execute function public.prevent_active_grade_rule_mutation();


-- Policy definitions become immutable once activated. is_active may be toggled
-- to select a successor version, but the historic policy configuration is kept.
create or replace function public.prevent_activated_policy_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.activated_at is not null and (to_jsonb(new) - 'is_active') is distinct from (to_jsonb(old) - 'is_active') then
    raise exception 'Activated policy definitions are immutable. Create a new policy version.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger grading_policy_lock_activated
  before update on public.grading_policies
  for each row when (old.activated_at is not null)
  execute function public.prevent_activated_policy_mutation();

create trigger calculation_policy_lock_activated
  before update on public.result_calculation_policies
  for each row when (old.activated_at is not null)
  execute function public.prevent_activated_policy_mutation();


create or replace function public.stamp_calculation_policy_activation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.is_active then
    new.activated_at := coalesce(new.activated_at, now());
  end if;
  return new;
end;
$$;

create trigger calculation_policy_stamp_activation
  before insert or update of is_active on public.result_calculation_policies
  for each row execute function public.stamp_calculation_policy_activation();

create unique index grading_policy_active_scope_unique
  on public.grading_policies (coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(program_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active;
create unique index calculation_policy_active_scope_unique
  on public.result_calculation_policies (coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(program_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active;

create or replace function public.validate_offering_assessment_scheme()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not exists (select 1 from public.assessment_schemes s where s.id = new.assessment_scheme_id and s.status = 'active') then
    raise exception 'Course offerings must reference an active assessment scheme.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger course_offering_assessment_scheme_active
  before insert or update of assessment_scheme_id on public.course_offerings
  for each row execute function public.validate_offering_assessment_scheme();

-- Authorization helpers. SECURITY DEFINER is limited to narrow boolean checks.

create or replace function public.has_app_role(_roles public.app_role[], _department_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id and p.account_status = 'active'
    where r.user_id = auth.uid()
      and r.is_active
      and r.role = any(_roles)
      and case r.role
        when 'super_admin' then true
        when 'department_admin' then _department_id is not null and r.department_id = _department_id
        when 'exam_controller' then r.department_id is null or (_department_id is not null and r.department_id = _department_id)
        else false
      end
  );
$$;

create or replace function public.is_offering_teacher(_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.offering_teachers ot
    join public.teachers t on t.id = ot.teacher_id
    join public.profiles p on p.id = t.profile_id and p.account_status = 'active'
    where ot.course_offering_id = _offering_id
      and t.profile_id = auth.uid()
      and t.account_status = 'active'
      and exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'teacher' and ur.is_active)
  );
$$;

create or replace function public.is_student_owner(_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.students s
    join public.profiles p on p.id = s.profile_id and p.account_status = 'active'
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'student' and ur.is_active
    where s.id = _student_id and s.profile_id = auth.uid() and s.account_status = 'active'
  );
$$;

create or replace function public.is_student_enrolled_in_offering(_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.course_enrollments ce
    join public.students s on s.id = ce.student_id
    join public.profiles p on p.id = s.profile_id and p.account_status = 'active'
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'student' and ur.is_active
    where ce.course_offering_id = _offering_id
      and s.profile_id = auth.uid()
      and s.account_status = 'active'
      and ce.status = 'active'
  );
$$;

create or replace function public.can_access_student(_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = _student_id
      and (
        public.is_student_owner(s.id)
        or public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], s.department_id)
        or exists (
          select 1 from public.course_enrollments ce
          where ce.student_id = s.id and public.is_offering_teacher(ce.course_offering_id)
        )
      )
  );
$$;

create or replace function public.can_access_program(_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.programs p
    where p.id = _program_id
      and (
        public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], p.department_id)
        or exists (select 1 from public.students s where s.program_id = p.id and public.is_student_owner(s.id))
        or exists (select 1 from public.course_offerings o where o.program_id = p.id and public.is_offering_teacher(o.id))
      )
  );
$$;

create or replace function public.can_access_course(_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.courses c
    where c.id = _course_id
      and (
        public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], c.department_id)
        or exists (select 1 from public.course_offerings o where o.course_id = c.id and public.is_offering_teacher(o.id))
        or exists (select 1 from public.course_offerings o where o.course_id = c.id and public.is_student_enrolled_in_offering(o.id))
        or exists (select 1 from public.program_courses pc join public.students s on s.program_id = pc.program_id where pc.course_id = c.id and public.is_student_owner(s.id))
      )
  );
$$;

create or replace function public.can_access_assessment_scheme(_scheme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.course_offerings o
    where o.assessment_scheme_id = _scheme_id
      and (
        public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], o.department_id)
        or public.is_offering_teacher(o.id)
        or public.is_student_enrolled_in_offering(o.id)
      )
  )
  or public.has_app_role(array['super_admin']::public.app_role[])
  or exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.account_status = 'active'
    where ur.user_id = auth.uid() and ur.is_active and ur.role in ('department_admin', 'exam_controller')
  );
$$;

revoke all on function public.has_app_role(public.app_role[], uuid) from public;
revoke all on function public.is_offering_teacher(uuid) from public;
revoke all on function public.can_access_student(uuid) from public;
revoke all on function public.is_student_enrolled_in_offering(uuid) from public;
revoke all on function public.is_student_owner(uuid) from public;
revoke all on function public.can_access_program(uuid) from public;
revoke all on function public.can_access_course(uuid) from public;
revoke all on function public.can_access_assessment_scheme(uuid) from public;
grant execute on function public.has_app_role(public.app_role[], uuid) to authenticated;
grant execute on function public.is_offering_teacher(uuid) to authenticated;
grant execute on function public.can_access_student(uuid) to authenticated;
grant execute on function public.is_student_enrolled_in_offering(uuid) to authenticated;
grant execute on function public.is_student_owner(uuid) to authenticated;
grant execute on function public.can_access_program(uuid) to authenticated;
grant execute on function public.can_access_course(uuid) to authenticated;
grant execute on function public.can_access_assessment_scheme(uuid) to authenticated;

-- RLS is enabled on every exposed table. Unmatched operations are denied.

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.departments enable row level security;
alter table public.programs enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.semester_definitions enable row level security;
alter table public.academic_terms enable row level security;
alter table public.students enable row level security;
alter table public.student_program_history enable row level security;
alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.program_courses enable row level security;
alter table public.assessment_schemes enable row level security;
alter table public.assessment_scheme_categories enable row level security;
alter table public.course_offerings enable row level security;
alter table public.offering_teachers enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.assessments enable row level security;
alter table public.student_marks enable row level security;
alter table public.grading_policies enable row level security;
alter table public.grade_rules enable row level security;
alter table public.result_calculation_policies enable row level security;
alter table public.course_equivalency_groups enable row level security;
alter table public.course_equivalencies enable row level security;
alter table public.course_results enable row level security;
alter table public.semester_results enable row level security;
alter table public.result_publications enable row level security;
alter table public.result_corrections enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles and role assignments.
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid() and account_status = 'active') with check (id = auth.uid() and account_status = 'active');
create policy profiles_select_super_admin on public.profiles
  for select to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]));
create policy roles_select_self_or_super_admin on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_app_role(array['super_admin']::public.app_role[]));
create policy roles_super_admin_manage on public.user_roles
  for all to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]))
  with check (public.has_app_role(array['super_admin']::public.app_role[]));

-- Academic directory and structure.
create policy departments_read_authenticated on public.departments
  for select to authenticated using (true);
create policy departments_super_admin_manage on public.departments
  for all to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]))
  with check (public.has_app_role(array['super_admin']::public.app_role[]));

create policy programs_read_authorized on public.programs
  for select to authenticated using (public.can_access_program(id));
create policy programs_department_manage on public.programs
  for all to authenticated using (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id))
  with check (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id));

create policy sessions_read_authenticated on public.academic_sessions
  for select to authenticated using (true);
create policy sessions_super_admin_manage on public.academic_sessions
  for all to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]))
  with check (public.has_app_role(array['super_admin']::public.app_role[]));

create policy semester_definitions_read_authorized on public.semester_definitions
  for select to authenticated using (public.can_access_program(program_id));
create policy semester_definitions_department_manage on public.semester_definitions
  for all to authenticated using (
    exists (select 1 from public.programs p where p.id = program_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], p.department_id))
  ) with check (
    exists (select 1 from public.programs p where p.id = program_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], p.department_id))
  );

create policy academic_terms_read_authorized on public.academic_terms
  for select to authenticated using (public.can_access_program(program_id));
create policy academic_terms_department_manage on public.academic_terms
  for all to authenticated using (
    exists (select 1 from public.programs p where p.id = program_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], p.department_id))
  ) with check (
    exists (select 1 from public.programs p where p.id = program_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], p.department_id))
  );

-- People and course delivery.
create policy students_select_authorized on public.students
  for select to authenticated using (public.can_access_student(id));
create policy students_super_admin_or_department_manage on public.students
  for all to authenticated using (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id))
  with check (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id));
create policy student_program_history_read_owner_or_staff on public.student_program_history
  for select to authenticated using (
    public.is_student_owner(student_id)
    or public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], department_id)
  );

create policy teachers_select_self_or_admin on public.teachers
  for select to authenticated using (
    profile_id = auth.uid() or public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], department_id)
  );
create policy teachers_department_manage on public.teachers
  for all to authenticated using (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id))
  with check (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id));

create policy courses_read_authorized on public.courses
  for select to authenticated using (public.can_access_course(id));
create policy courses_department_manage on public.courses
  for all to authenticated using (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id))
  with check (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id));

create policy program_courses_read_authorized on public.program_courses
  for select to authenticated using (public.can_access_program(program_id) or public.can_access_course(course_id));
create policy program_courses_department_manage on public.program_courses
  for all to authenticated using (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id))
  with check (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id));

create policy assessment_schemes_read_authorized on public.assessment_schemes
  for select to authenticated using (public.can_access_assessment_scheme(id));
create policy assessment_schemes_super_admin_manage on public.assessment_schemes
  for all to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]))
  with check (public.has_app_role(array['super_admin']::public.app_role[]));

create policy scheme_categories_read_authorized on public.assessment_scheme_categories
  for select to authenticated using (public.can_access_assessment_scheme(scheme_id));
create policy scheme_categories_super_admin_manage on public.assessment_scheme_categories
  for all to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]))
  with check (public.has_app_role(array['super_admin']::public.app_role[]));

create policy offerings_read_authorized on public.course_offerings
  for select to authenticated using (
    public.is_offering_teacher(id)
    or public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], department_id)
    or public.is_student_enrolled_in_offering(id)
  );
create policy offerings_department_manage on public.course_offerings
  for all to authenticated using (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id))
  with check (public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], department_id));

create policy offering_teachers_read_authorized on public.offering_teachers
  for select to authenticated using (
    public.is_offering_teacher(course_offering_id)
    or exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], o.department_id))
  );
create policy offering_teachers_department_manage on public.offering_teachers
  for all to authenticated using (
    exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], o.department_id))
  ) with check (
    exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], o.department_id))
  );

create policy enrollments_read_authorized on public.course_enrollments
  for select to authenticated using (
    public.is_student_owner(student_id)
    or public.is_offering_teacher(course_offering_id)
    or exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], o.department_id))
  );
create policy enrollments_department_manage on public.course_enrollments
  for all to authenticated using (
    exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], o.department_id))
  ) with check (
    exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], o.department_id))
  );

create policy assessments_read_authorized on public.assessments
  for select to authenticated using (
    public.is_offering_teacher(course_offering_id)
    or exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], o.department_id))
  );
create policy assessments_department_manage on public.assessments
  for all to authenticated using (
    exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], o.department_id))
  ) with check (
    exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], o.department_id))
  );

create policy marks_read_assigned_staff on public.student_marks
  for select to authenticated using (
    public.is_offering_teacher(course_offering_id)
    or exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], o.department_id))
  );
create policy marks_teacher_insert on public.student_marks
  for insert to authenticated with check (
    public.is_offering_teacher(course_offering_id)
    or exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], o.department_id))
  );
create policy marks_teacher_update on public.student_marks
  for update to authenticated using (
    public.is_offering_teacher(course_offering_id)
    or exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], o.department_id))
  ) with check (
    public.is_offering_teacher(course_offering_id)
    or exists (select 1 from public.course_offerings o where o.id = course_offering_id and public.has_app_role(array['super_admin', 'department_admin']::public.app_role[], o.department_id))
  );

-- Policy records are visible to signed-in staff; management is centrally scoped.
create policy grading_policies_read_staff on public.grading_policies
  for select to authenticated using (public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], department_id));
create policy grading_policies_super_admin_manage on public.grading_policies
  for all to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]))
  with check (public.has_app_role(array['super_admin']::public.app_role[]));

create policy grade_rules_read_staff on public.grade_rules
  for select to authenticated using (
    exists (select 1 from public.grading_policies gp where gp.id = grading_policy_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], gp.department_id))
  );
create policy grade_rules_super_admin_manage on public.grade_rules
  for all to authenticated using (
    exists (select 1 from public.grading_policies gp where gp.id = grading_policy_id and public.has_app_role(array['super_admin']::public.app_role[]))
  ) with check (
    exists (select 1 from public.grading_policies gp where gp.id = grading_policy_id and public.has_app_role(array['super_admin']::public.app_role[]))
  );

create policy calculation_policies_read_staff on public.result_calculation_policies
  for select to authenticated using (public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], department_id));
create policy calculation_policies_super_admin_manage on public.result_calculation_policies
  for all to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]))
  with check (public.has_app_role(array['super_admin']::public.app_role[]));

create policy equivalency_groups_read_staff on public.course_equivalency_groups
  for select to authenticated using (
    exists (select 1 from public.programs p where p.id = program_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], p.department_id))
  );
create policy equivalency_groups_super_admin_manage on public.course_equivalency_groups
  for all to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]))
  with check (public.has_app_role(array['super_admin']::public.app_role[]));
create policy equivalencies_read_staff on public.course_equivalencies
  for select to authenticated using (
    exists (select 1 from public.course_equivalency_groups g join public.programs p on p.id = g.program_id where g.id = group_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], p.department_id))
  );
create policy equivalencies_super_admin_manage on public.course_equivalencies
  for all to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]))
  with check (public.has_app_role(array['super_admin']::public.app_role[]));

-- Students only see their own published results. Drafts, submitted marks, and
-- unapproved results remain inaccessible to student accounts.
create policy course_results_read_published_own_or_staff on public.course_results
  for select to authenticated using (
    (status in ('published', 'locked') and exists (
      select 1
      from public.course_enrollments ce
      join public.students s on s.id = ce.student_id
      join public.course_offerings o on o.id = ce.course_offering_id
      where ce.id = course_results.enrollment_id
        and public.is_student_owner(s.id)
        and exists (
          select 1 from public.semester_results sr
          where sr.student_id = s.id and sr.academic_term_id = o.academic_term_id
            and sr.status in ('published', 'locked')
        )
    ))
    or exists (
      select 1 from public.course_offerings o where o.id = course_offering_id
      and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], o.department_id)
    )
  );

create policy semester_results_read_published_own_or_staff on public.semester_results
  for select to authenticated using (
    (status in ('published', 'locked') and public.is_student_owner(student_id))
    or exists (
      select 1 from public.students s where s.id = student_id
      and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], s.department_id)
    )
  );

create policy publications_read_own_or_staff on public.result_publications
  for select to authenticated using (
    exists (
      select 1 from public.semester_results sr
      join public.students s on s.id = sr.student_id
      where sr.academic_term_id = result_publications.academic_term_id
        and sr.status in ('published', 'locked') and public.is_student_owner(s.id)
    )
    or exists (
      select 1 from public.academic_terms t join public.programs p on p.id = t.program_id
      where t.id = result_publications.academic_term_id
        and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], p.department_id)
    )
  );

create policy corrections_read_staff on public.result_corrections
  for select to authenticated using (
    (course_result_id is not null and exists (select 1 from public.course_results cr join public.course_offerings o on o.id = cr.course_offering_id where cr.id = course_result_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], o.department_id)))
    or (semester_result_id is not null and exists (select 1 from public.semester_results sr join public.students s on s.id = sr.student_id where sr.id = semester_result_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], s.department_id)))
  );
create policy corrections_request_by_staff on public.result_corrections
  for insert to authenticated with check (
    requested_by = auth.uid()
    and ((course_result_id is not null and exists (select 1 from public.course_results cr join public.course_offerings o on o.id = cr.course_offering_id where cr.id = course_result_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], o.department_id)))
      or (semester_result_id is not null and exists (select 1 from public.semester_results sr join public.students s on s.id = sr.student_id where sr.id = semester_result_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], s.department_id))))
  );
create policy audit_logs_read_super_admin on public.audit_logs
  for select to authenticated using (public.has_app_role(array['super_admin']::public.app_role[]));

-- The single dashboard summary function returns counts under the caller's RLS.
create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_summary jsonb;
begin
  if not public.has_app_role(array['super_admin', 'exam_controller']::public.app_role[])
     and not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('department_admin', 'exam_controller') and ur.is_active) then
    raise exception 'Not authorized to read the administration dashboard.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'students', (select count(*) from public.students s where s.account_status = 'active' and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], s.department_id)),
    'programs', (select count(*) from public.programs p where p.status = 'active' and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], p.department_id)),
    'activeTerms', (select count(*) from public.academic_terms t join public.programs p on p.id = t.program_id where t.status = 'active' and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], p.department_id)),
    'pendingApprovals', (select count(*) from public.semester_results sr join public.students s on s.id = sr.student_id where sr.status in ('submitted', 'under_review') and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], s.department_id)),
    'courses', (select count(*) from public.courses c where c.status = 'active' and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], c.department_id)),
    'teachers', (select count(*) from public.teachers t where t.account_status = 'active' and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], t.department_id)),
    'marksToSubmit', (
      select count(*)
      from public.assessments a
      join public.course_enrollments ce on ce.course_offering_id = a.course_offering_id and ce.status = 'active'
      left join public.student_marks sm on sm.assessment_id = a.id and sm.enrollment_id = ce.id
      where a.status = 'active' and (sm.id is null or sm.status = 'pending')
        and exists (select 1 from public.course_offerings o where o.id = a.course_offering_id and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], o.department_id))
    ),
    'publishedResults', (select count(*) from public.semester_results sr join public.students s on s.id = sr.student_id where sr.status in ('published', 'locked') and public.has_app_role(array['super_admin', 'department_admin', 'exam_controller']::public.app_role[], s.department_id))
  ) into v_summary;

  return v_summary;
end;
$$;

revoke all on function public.get_dashboard_summary() from public;
grant execute on function public.get_dashboard_summary() to authenticated;

-- Exposed tables are reachable only by signed-in users; RLS determines rows
-- and the narrower policies above determine which operations are allowed.
revoke all on all tables in schema public from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public revoke all on tables from anon, public;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- Keep ordinary profile updates limited to the display name. Role assignments,
-- department scopes, account status, and email are not self-service fields.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

comment on table public.student_program_history is 'Effective-dated history of a student’s department, program, and intake/cohort assignment; rows are created/closed by the student identity trigger.';
comment on table public.academic_sessions is 'Student intake/cohort sessions; distinct from academic_terms.';
comment on table public.academic_terms is 'Actual teaching/examination period for a semester definition in an academic session.';
comment on table public.grade_rules is 'Minimum marks are inclusive and maximum marks are exclusive; the final band ending at 100 includes a mark of exactly 100.';
comment on table public.student_marks is 'One status/mark per enrolled student and assessment; missing rows are not interpreted as zero.';
comment on table public.course_results is 'Versioned course-result snapshots. Published and locked snapshots are immutable.';
comment on table public.semester_results is 'Versioned semester GPA/CGPA snapshots. Published and locked snapshots are immutable.';
comment on function public.get_dashboard_summary() is 'Returns administrator dashboard counts subject to caller RLS policies.';
