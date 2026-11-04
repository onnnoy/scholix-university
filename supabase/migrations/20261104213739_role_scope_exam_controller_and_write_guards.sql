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
        ur.role NOT IN ('department_admin', 'exam_controller')
        OR (ur.role = 'exam_controller' AND ur.department_id IS NULL)
        OR (p_department IS NOT NULL AND ur.department_id = p_department)
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_review_course_result(p_course_result_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
    OR EXISTS (
      SELECT 1
      FROM public.course_results cr
      JOIN public.course_enrollments ce ON ce.id = cr.enrollment_id
      JOIN public.course_offerings co ON co.id = ce.course_offering_id
      WHERE cr.id = p_course_result_id
        AND private.has_role(ARRAY['exam_controller']::public.app_role[], co.department_id)
    );
$$;
REVOKE ALL ON FUNCTION private.can_review_course_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_review_course_result(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_course_result(p_course_result_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.result_status;
BEGIN
  IF NOT private.can_review_course_result(p_course_result_id) THEN
    RAISE EXCEPTION 'Examination Controller permission required for this course result';
  END IF;

  SELECT status INTO v_status
  FROM public.course_results
  WHERE id = p_course_result_id
  FOR UPDATE;

  IF v_status IS NULL THEN RAISE EXCEPTION 'Course result not found'; END IF;
  IF v_status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Only submitted or under-review results can be approved';
  END IF;

  UPDATE public.course_results
  SET status = 'approved',
      approved_by = (SELECT auth.uid()),
      approved_at = now(),
      updated_at = now()
  WHERE id = p_course_result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_course_result(p_enrollment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_offering uuid;
  v_department uuid;
  v_scheme uuid;
  v_policy uuid;
  v_precision integer;
  v_total_weight numeric;
  v_total numeric;
  v_grade_count integer;
  v_grade text;
  v_gp numeric;
  v_pass boolean;
  v_result_id uuid;
  v_version integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT ce.course_offering_id, co.department_id, co.assessment_scheme_id, co.grading_policy_id
  INTO v_offering, v_department, v_scheme, v_policy
  FROM public.course_enrollments ce
  JOIN public.course_offerings co ON co.id = ce.course_offering_id
  WHERE ce.id = p_enrollment_id AND ce.enrollment_status = 'enrolled';

  IF v_offering IS NULL THEN RAISE EXCEPTION 'Active course enrollment not found'; END IF;

  -- Only an active assigned teacher or Super Administrator can calculate a course result.
  IF NOT (
    private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
    OR private.is_assigned_teacher(v_offering)
  ) THEN
    RAISE EXCEPTION 'Only the assigned teacher or Super Administrator can calculate this course result';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assessments a
    LEFT JOIN public.student_marks sm
      ON sm.assessment_id = a.id AND sm.enrollment_id = p_enrollment_id
    WHERE a.course_offering_id = v_offering
      AND a.status = 'active'
      AND a.is_required
      AND (sm.id IS NULL OR sm.status <> 'present' OR sm.marks_obtained IS NULL)
  ) THEN
    RAISE EXCEPTION 'Result incomplete: required marks are missing or absent/excused status needs an approved institutional policy';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assessment_categories ac
    WHERE ac.scheme_id = v_scheme
      AND ac.weight > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.assessments a
        WHERE a.course_offering_id = v_offering
          AND a.category_id = ac.id
          AND a.status = 'active'
      )
  ) THEN
    RAISE EXCEPTION 'Assessment scheme has a weighted category with no active assessments';
  END IF;

  SELECT COALESCE(sum(ac.weight), 0)
  INTO v_total_weight
  FROM public.assessment_categories ac
  WHERE ac.scheme_id = v_scheme;

  IF v_total_weight <> 100 THEN RAISE EXCEPTION 'Assessment scheme weights must total exactly 100'; END IF;

  SELECT gp.rounding_precision INTO v_precision
  FROM public.grading_policies gp WHERE gp.id = v_policy;

  SELECT round(
    COALESCE(sum(
      CASE WHEN COALESCE(cat.max_sum, 0) > 0
        THEN (cat.obtained_sum / cat.max_sum) * ac.weight
        ELSE 0
      END
    ), 0),
    v_precision
  )
  INTO v_total
  FROM public.assessment_categories ac
  LEFT JOIN LATERAL (
    SELECT
      sum(a.max_marks) FILTER (WHERE sm.status = 'present') AS max_sum,
      sum(sm.marks_obtained) FILTER (WHERE sm.status = 'present') AS obtained_sum
    FROM public.assessments a
    LEFT JOIN public.student_marks sm
      ON sm.assessment_id = a.id AND sm.enrollment_id = p_enrollment_id
    WHERE a.course_offering_id = v_offering
      AND a.status = 'active'
      AND a.category_id = ac.id
  ) cat ON true
  WHERE ac.scheme_id = v_scheme;

  SELECT count(*), min(gr.letter_grade), min(gr.grade_point), bool_and(gr.is_passing)
  INTO v_grade_count, v_grade, v_gp, v_pass
  FROM public.grade_rules gr
  WHERE gr.grading_policy_id = v_policy
    AND v_total BETWEEN gr.min_marks AND gr.max_marks;

  IF v_grade_count <> 1 THEN
    RAISE EXCEPTION 'Grading policy must match exactly one grade rule for marks %', v_total;
  END IF;

  SELECT COALESCE(max(cr.version), 0) + 1 INTO v_version
  FROM public.course_results cr WHERE cr.enrollment_id = p_enrollment_id;

  INSERT INTO public.course_results(
    enrollment_id, grading_policy_id, status, total_marks, letter_grade,
    grade_point, is_passing, calculation_snapshot, version, calculated_at
  )
  VALUES (
    p_enrollment_id, v_policy, 'draft', v_total, v_grade,
    v_gp, v_pass,
    jsonb_build_object(
      'scheme_id', v_scheme,
      'weight_total', v_total_weight,
      'calculated_by', v_user,
      'calculation_version', 1
    ),
    v_version,
    now()
  )
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$;

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
  SELECT co.department_id INTO v_department
  FROM public.course_offerings co
  WHERE co.id = p_course_offering_id AND co.status = 'active';

  IF v_department IS NULL THEN RAISE EXCEPTION 'Active course offering not found'; END IF;

  IF NOT (
    private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
    OR private.is_assigned_teacher(p_course_offering_id)
  ) THEN
    RAISE EXCEPTION 'Only the assigned teacher or Super Administrator can process this offering';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.course_enrollments ce
  WHERE ce.course_offering_id = p_course_offering_id
    AND ce.enrollment_status = 'enrolled';

  IF v_total = 0 THEN RAISE EXCEPTION 'No active student enrollments for this offering'; END IF;

  FOR v_enrollment_id IN
    SELECT ce.id FROM public.course_enrollments ce
    WHERE ce.course_offering_id = p_course_offering_id
      AND ce.enrollment_status = 'enrolled'
    ORDER BY ce.id
  LOOP
    SELECT cr.status INTO v_latest_status
    FROM public.course_results cr
    WHERE cr.enrollment_id = v_enrollment_id
    ORDER BY cr.version DESC
    LIMIT 1;

    IF v_latest_status IN ('submitted', 'under_review', 'approved', 'published', 'locked') THEN
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

-- Only Super Administrators may change institution-wide setup and grading policy.
DROP POLICY IF EXISTS sessions_write_admin ON public.academic_sessions;
CREATE POLICY sessions_write_admin ON public.academic_sessions
FOR ALL TO authenticated
USING (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid))
WITH CHECK (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid));

DROP POLICY IF EXISTS categories_write_admin ON public.assessment_categories;
CREATE POLICY categories_write_admin ON public.assessment_categories
FOR ALL TO authenticated
USING (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid))
WITH CHECK (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid));

DROP POLICY IF EXISTS schemes_write_admin ON public.assessment_schemes;
CREATE POLICY schemes_write_admin ON public.assessment_schemes
FOR ALL TO authenticated
USING (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid))
WITH CHECK (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid));

DROP POLICY IF EXISTS grade_rules_write_admin ON public.grade_rules;
CREATE POLICY grade_rules_write_admin ON public.grade_rules
FOR ALL TO authenticated
USING (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid))
WITH CHECK (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid));

DROP POLICY IF EXISTS grading_policies_write_admin ON public.grading_policies;
CREATE POLICY grading_policies_write_admin ON public.grading_policies
FOR ALL TO authenticated
USING (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid))
WITH CHECK (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid));

DROP POLICY IF EXISTS terms_write_scope ON public.academic_terms;
CREATE POLICY terms_write_scope ON public.academic_terms
FOR ALL TO authenticated
USING (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = academic_terms.program_id
      AND private.can_access_department(p.department_id)
  )
)
WITH CHECK (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = academic_terms.program_id
      AND private.can_access_department(p.department_id)
  )
);

DROP POLICY IF EXISTS assessments_write_scope ON public.assessments;
CREATE POLICY assessments_write_scope ON public.assessments
FOR ALL TO authenticated
USING (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_offerings co
    WHERE co.id = assessments.course_offering_id
      AND private.can_access_department(co.department_id)
  )
)
WITH CHECK (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_offerings co
    WHERE co.id = assessments.course_offering_id
      AND private.can_access_department(co.department_id)
  )
);

DROP POLICY IF EXISTS enrollments_write_scope ON public.course_enrollments;
CREATE POLICY enrollments_write_scope ON public.course_enrollments
FOR ALL TO authenticated
USING (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_offerings co
    WHERE co.id = course_enrollments.course_offering_id
      AND private.can_access_department(co.department_id)
  )
)
WITH CHECK (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_offerings co
    WHERE co.id = course_enrollments.course_offering_id
      AND private.can_access_department(co.department_id)
  )
);

DROP POLICY IF EXISTS equivalencies_write_scope ON public.course_equivalencies;
CREATE POLICY equivalencies_write_scope ON public.course_equivalencies
FOR ALL TO authenticated
USING (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = course_equivalencies.program_id
      AND private.can_access_department(p.department_id)
  )
)
WITH CHECK (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = course_equivalencies.program_id
      AND private.can_access_department(p.department_id)
  )
);

DROP POLICY IF EXISTS offerings_write_scope ON public.course_offerings;
CREATE POLICY offerings_write_scope ON public.course_offerings
FOR ALL TO authenticated
USING (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR private.can_access_department(department_id)
)
WITH CHECK (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR private.can_access_department(department_id)
);

DROP POLICY IF EXISTS offering_teachers_write ON public.offering_teachers;
CREATE POLICY offering_teachers_write ON public.offering_teachers
FOR ALL TO authenticated
USING (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_offerings co
    WHERE co.id = offering_teachers.course_offering_id
      AND private.can_access_department(co.department_id)
  )
)
WITH CHECK (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_offerings co
    WHERE co.id = offering_teachers.course_offering_id
      AND private.can_access_department(co.department_id)
  )
);

-- Scoped Examination Controllers can read and approve results only in their own department.
DROP POLICY IF EXISTS assessments_read_scope ON public.assessments;
CREATE POLICY assessments_read_scope ON public.assessments
FOR SELECT TO authenticated
USING (
  private.has_role(ARRAY['super_admin','exam_controller']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_offerings co
    WHERE co.id = assessments.course_offering_id
      AND (
        private.can_access_department(co.department_id)
        OR private.has_role(ARRAY['exam_controller']::public.app_role[], co.department_id)
        OR private.is_assigned_teacher(co.id)
        OR EXISTS (
          SELECT 1 FROM public.course_enrollments ce
          JOIN public.students s ON s.id = ce.student_id
          WHERE ce.course_offering_id = co.id
            AND s.user_id = (SELECT auth.uid())
        )
      )
  )
);

DROP POLICY IF EXISTS enrollments_read_scope ON public.course_enrollments;
CREATE POLICY enrollments_read_scope ON public.course_enrollments
FOR SELECT TO authenticated
USING (
  private.is_student_owner(student_id)
  OR private.has_role(ARRAY['super_admin','exam_controller']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_offerings co
    WHERE co.id = course_enrollments.course_offering_id
      AND (
        private.can_access_department(co.department_id)
        OR private.has_role(ARRAY['exam_controller']::public.app_role[], co.department_id)
        OR private.is_assigned_teacher(co.id)
      )
  )
);

DROP POLICY IF EXISTS offerings_read_scope ON public.course_offerings;
CREATE POLICY offerings_read_scope ON public.course_offerings
FOR SELECT TO authenticated
USING (
  private.has_role(ARRAY['super_admin','exam_controller']::public.app_role[], NULL::uuid)
  OR private.can_access_department(department_id)
  OR private.has_role(ARRAY['exam_controller']::public.app_role[], department_id)
  OR private.is_assigned_teacher(id)
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    JOIN public.students s ON s.id = ce.student_id
    WHERE ce.course_offering_id = course_offerings.id
      AND s.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS course_results_read_scope ON public.course_results;
CREATE POLICY course_results_read_scope ON public.course_results
FOR SELECT TO authenticated
USING (
  private.has_role(ARRAY['super_admin','exam_controller']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    JOIN public.students s ON s.id = ce.student_id
    WHERE ce.id = course_results.enrollment_id
      AND s.user_id = (SELECT auth.uid())
      AND course_results.status = 'published'
  )
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    JOIN public.course_offerings co ON co.id = ce.course_offering_id
    WHERE ce.id = course_results.enrollment_id
      AND (
        private.can_access_department(co.department_id)
        OR private.has_role(ARRAY['exam_controller']::public.app_role[], co.department_id)
        OR private.is_assigned_teacher(co.id)
      )
  )
);

DROP POLICY IF EXISTS marks_read_scope ON public.student_marks;
CREATE POLICY marks_read_scope ON public.student_marks
FOR SELECT TO authenticated
USING (
  private.has_role(ARRAY['super_admin','exam_controller']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    JOIN public.students s ON s.id = ce.student_id
    JOIN public.course_results cr ON cr.enrollment_id = ce.id
    WHERE ce.id = student_marks.enrollment_id
      AND s.user_id = (SELECT auth.uid())
      AND cr.status = 'published'
  )
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    JOIN public.course_offerings co ON co.id = ce.course_offering_id
    WHERE ce.id = student_marks.enrollment_id
      AND (
        private.can_access_department(co.department_id)
        OR private.has_role(ARRAY['exam_controller']::public.app_role[], co.department_id)
        OR private.is_assigned_teacher(co.id)
      )
  )
);

DROP POLICY IF EXISTS students_read_scope ON public.students;
CREATE POLICY students_read_scope ON public.students
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR private.has_role(ARRAY['super_admin','exam_controller']::public.app_role[], NULL::uuid)
  OR private.can_access_department(department_id)
  OR private.has_role(ARRAY['exam_controller']::public.app_role[], department_id)
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    JOIN public.course_offerings co ON co.id = ce.course_offering_id
    WHERE ce.student_id = students.id
      AND private.is_assigned_teacher(co.id)
  )
);

DROP POLICY IF EXISTS teachers_read_scope ON public.teachers;
CREATE POLICY teachers_read_scope ON public.teachers
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR private.has_role(ARRAY['super_admin','exam_controller']::public.app_role[], NULL::uuid)
  OR private.can_access_department(department_id)
  OR private.has_role(ARRAY['exam_controller']::public.app_role[], department_id)
);

DROP POLICY IF EXISTS semester_results_read_scope ON public.semester_results;
CREATE POLICY semester_results_read_scope ON public.semester_results
FOR SELECT TO authenticated
USING (
  (private.is_student_owner(student_id) AND status = 'published')
  OR private.has_role(ARRAY['super_admin','exam_controller']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = semester_results.student_id
      AND (
        private.can_access_department(s.department_id)
        OR private.has_role(ARRAY['exam_controller']::public.app_role[], s.department_id)
      )
  )
);

DROP POLICY IF EXISTS programs_read_scope ON public.programs;
CREATE POLICY programs_read_scope ON public.programs
FOR SELECT TO authenticated
USING (
  private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid)
  OR private.can_access_department(department_id)
  OR private.has_role(ARRAY['exam_controller']::public.app_role[], department_id)
);

DROP POLICY IF EXISTS terms_read_scope ON public.academic_terms;
CREATE POLICY terms_read_scope ON public.academic_terms
FOR SELECT TO authenticated
USING (
  private.has_role(ARRAY['super_admin','exam_controller']::public.app_role[], NULL::uuid)
  OR EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = academic_terms.program_id
      AND (
        private.can_access_department(p.department_id)
        OR private.has_role(ARRAY['exam_controller']::public.app_role[], p.department_id)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.program_id = academic_terms.program_id
      AND s.user_id = (SELECT auth.uid())
  )
);

-- Semester-level publication remains a planned workflow; only the Super Administrator can write publication rows.
DROP POLICY IF EXISTS publications_write_controller ON public.result_publications;
CREATE POLICY publications_write_controller ON public.result_publications
FOR INSERT TO authenticated
WITH CHECK (private.has_role(ARRAY['super_admin']::public.app_role[], NULL::uuid));

DROP POLICY IF EXISTS corrections_insert_authorized ON public.result_corrections;
CREATE POLICY corrections_insert_authorized ON public.result_corrections
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = (SELECT auth.uid())
  AND private.can_review_course_result(course_result_id)
);

DROP POLICY IF EXISTS corrections_read_scope ON public.result_corrections;
CREATE POLICY corrections_read_scope ON public.result_corrections
FOR SELECT TO authenticated
USING (
  requested_by = (SELECT auth.uid())
  OR private.can_review_course_result(course_result_id)
);

DROP POLICY IF EXISTS corrections_review_controller ON public.result_corrections;
CREATE POLICY corrections_review_controller ON public.result_corrections
FOR UPDATE TO authenticated
USING (private.can_review_course_result(course_result_id))
WITH CHECK (private.can_review_course_result(course_result_id));
