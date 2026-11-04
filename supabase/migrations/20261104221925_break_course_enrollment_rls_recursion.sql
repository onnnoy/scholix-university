CREATE OR REPLACE FUNCTION private.can_read_course_offering(p_offering_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_offerings co
    WHERE co.id = p_offering_id
      AND (
        private.has_role(
          ARRAY['super_admin', 'exam_controller']::public.app_role[],
          NULL::uuid
        )
        OR private.can_access_department(co.department_id)
        OR private.has_role(
          ARRAY['exam_controller']::public.app_role[],
          co.department_id
        )
        OR private.is_assigned_teacher(co.id)
        OR EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          JOIN public.students s ON s.id = ce.student_id
          WHERE ce.course_offering_id = co.id
            AND s.user_id = (SELECT auth.uid())
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_read_course_enrollment(p_enrollment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_enrollments ce
    JOIN public.course_offerings co ON co.id = ce.course_offering_id
    WHERE ce.id = p_enrollment_id
      AND (
        private.is_student_owner(ce.student_id)
        OR private.has_role(
          ARRAY['super_admin', 'exam_controller']::public.app_role[],
          NULL::uuid
        )
        OR private.can_access_department(co.department_id)
        OR private.has_role(
          ARRAY['exam_controller']::public.app_role[],
          co.department_id
        )
        OR private.is_assigned_teacher(co.id)
      )
  );
$$;

REVOKE ALL ON FUNCTION private.can_read_course_offering(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_read_course_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_read_course_offering(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_course_enrollment(uuid) TO authenticated;

DROP POLICY IF EXISTS offerings_read_scope ON public.course_offerings;
CREATE POLICY offerings_read_scope
ON public.course_offerings
FOR SELECT TO authenticated
USING (private.can_read_course_offering(id));

DROP POLICY IF EXISTS enrollments_read_scope ON public.course_enrollments;
CREATE POLICY enrollments_read_scope
ON public.course_enrollments
FOR SELECT TO authenticated
USING (private.can_read_course_enrollment(id));
