CREATE OR REPLACE FUNCTION public.submit_course_result(p_course_result_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offering uuid;
  v_status public.result_status;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT ce.course_offering_id, cr.status
  INTO v_offering, v_status
  FROM public.course_results cr
  JOIN public.course_enrollments ce ON ce.id = cr.enrollment_id
  WHERE cr.id = p_course_result_id
  FOR UPDATE OF cr;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Course result not found';
  END IF;

  IF NOT (
    private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
    OR private.is_assigned_teacher(v_offering)
  ) THEN
    RAISE EXCEPTION 'Only the assigned teacher or Super Administrator can submit this course result';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft results can be submitted';
  END IF;

  UPDATE public.course_results
  SET status = 'submitted', updated_at = now()
  WHERE id = p_course_result_id;
END;
$$;
