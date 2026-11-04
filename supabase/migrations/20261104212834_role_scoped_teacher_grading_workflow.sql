CREATE OR REPLACE FUNCTION private.has_role(
  p_roles public.app_role[],
  p_department uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role = ANY (p_roles)
      AND ur.is_active = true
      AND p.is_active = true
      AND p.account_status = 'active'
      AND (
        ur.role <> 'department_admin'
        OR (p_department IS NOT NULL AND ur.department_id = p_department)
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_access_department(p_department uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
      OR private.has_role(ARRAY['department_admin']::public.app_role[], p_department);
$$;

CREATE OR REPLACE FUNCTION private.is_assigned_teacher(p_offering uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.offering_teachers ot
    JOIN public.teachers t ON t.id = ot.teacher_id
    JOIN public.user_roles ur ON ur.user_id = t.user_id
    JOIN public.profiles p ON p.id = t.user_id
    WHERE ot.course_offering_id = p_offering
      AND t.user_id = (SELECT auth.uid())
      AND t.account_status = 'active'
      AND ur.role = 'teacher'
      AND ur.is_active = true
      AND (ur.department_id IS NULL OR ur.department_id = t.department_id)
      AND p.is_active = true
      AND p.account_status = 'active'
  );
$$;

DROP POLICY IF EXISTS marks_teacher_write ON public.student_marks;
DROP POLICY IF EXISTS marks_authorized_write ON public.student_marks;
CREATE POLICY marks_authorized_write
ON public.student_marks
FOR ALL
TO authenticated
USING (
  (
    private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
    OR EXISTS (
      SELECT 1
      FROM public.course_enrollments ce
      JOIN public.course_offerings co ON co.id = ce.course_offering_id
      WHERE ce.id = student_marks.enrollment_id
        AND (
          private.can_access_department(co.department_id)
          OR private.is_assigned_teacher(co.id)
        )
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.course_results cr
    WHERE cr.enrollment_id = student_marks.enrollment_id
      AND cr.status IN ('submitted','under_review','approved','published','locked')
  )
)
WITH CHECK (
  (
    private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
    OR EXISTS (
      SELECT 1
      FROM public.course_enrollments ce
      JOIN public.course_offerings co ON co.id = ce.course_offering_id
      WHERE ce.id = student_marks.enrollment_id
        AND (
          private.can_access_department(co.department_id)
          OR private.is_assigned_teacher(co.id)
        )
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.course_results cr
    WHERE cr.enrollment_id = student_marks.enrollment_id
      AND cr.status IN ('submitted','under_review','approved','published','locked')
  )
);

CREATE OR REPLACE FUNCTION public.process_course_offering(p_course_offering_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_department uuid;
  v_enrollment_id uuid;
  v_latest_status public.result_status;
  v_result_id uuid;
  v_total integer := 0;
  v_processed integer := 0;
  v_skipped integer := 0;
BEGIN
  SELECT co.department_id
    INTO v_department
  FROM public.course_offerings co
  WHERE co.id = p_course_offering_id
    AND co.status = 'active';

  IF v_department IS NULL THEN
    RAISE EXCEPTION 'Active course offering not found';
  END IF;

  IF NOT (
    private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
    OR private.can_access_department(v_department)
    OR private.is_assigned_teacher(p_course_offering_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to process this course offering';
  END IF;

  SELECT count(*)
    INTO v_total
  FROM public.course_enrollments ce
  WHERE ce.course_offering_id = p_course_offering_id
    AND ce.enrollment_status = 'enrolled';

  IF v_total = 0 THEN
    RAISE EXCEPTION 'No active student enrollments for this offering';
  END IF;

  FOR v_enrollment_id IN
    SELECT ce.id
    FROM public.course_enrollments ce
    WHERE ce.course_offering_id = p_course_offering_id
      AND ce.enrollment_status = 'enrolled'
    ORDER BY ce.id
  LOOP
    SELECT cr.status
      INTO v_latest_status
    FROM public.course_results cr
    WHERE cr.enrollment_id = v_enrollment_id
    ORDER BY cr.version DESC
    LIMIT 1;

    IF v_latest_status IN ('submitted','under_review','approved','published','locked') THEN
      v_skipped := v_skipped + 1;
    ELSE
      v_result_id := public.calculate_course_result(v_enrollment_id);
      PERFORM public.submit_course_result(v_result_id);
      v_processed := v_processed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed_count', v_processed,
    'skipped_count', v_skipped,
    'enrollment_count', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_course_offering(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_course_offering(uuid) TO authenticated;

UPDATE public.user_roles ur
SET role = 'department_admin'
FROM public.profiles p
WHERE p.id = ur.user_id
  AND p.email = 'department@scholix.demo'
  AND ur.role = 'teacher'
  AND ur.is_active = true;

UPDATE public.user_roles ur
SET role = 'exam_controller',
    department_id = NULL
FROM public.profiles p
WHERE p.id = ur.user_id
  AND p.email = 'controller@scholix.demo'
  AND ur.role = 'teacher'
  AND ur.is_active = true;
