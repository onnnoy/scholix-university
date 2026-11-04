import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const send = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const asText = (v: unknown) => String(v ?? "").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return send(405, { error: "Method not allowed." });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !anon || !secret || !authorization) return send(500, { error: "Admin data service is unavailable." });

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: identityError } = await caller.auth.getUser();
  if (identityError || !identity.user) return send(401, { error: "Please sign in again." });

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return send(400, { error: "Invalid request." });
  const action = asText(body.action);
  const userId = identity.user.id;
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    admin.from("profiles").select("account_status,is_active").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("role,department_id").eq("user_id", userId).eq("is_active", true),
  ]);
  if (!profile || profile.account_status !== "active" || profile.is_active !== true) return send(403, { error: "Your account is inactive. Contact an administrator." });
  const activeRoles = roleRows ?? [];
  const roleNames = new Set(activeRoles.map((row) => row.role));
  const isSuperAdmin = roleNames.has("super_admin");
  const isDepartmentAdmin = roleNames.has("department_admin");
  const isExamController = roleNames.has("exam_controller");
  const isTeacher = roleNames.has("teacher");
  const isStudent = roleNames.has("student");
  const departmentScopes = [...new Set(activeRoles.filter((row) => ["department_admin", "exam_controller"].includes(row.role) && row.department_id).map((row) => row.department_id as string))];
  const hasGlobalExamScope = activeRoles.some((row) => row.role === "exam_controller" && !row.department_id);
  const canManageDepartment = (id: string | null | undefined) => isSuperAdmin || Boolean(isDepartmentAdmin && id && departmentScopes.includes(id));
  const canReadRowDepartment = (id: string | null | undefined) => isSuperAdmin || hasGlobalExamScope || Boolean(id && departmentScopes.includes(id));
  const activeTeacher = async () => {
    if (!isTeacher) return null;
    const { data } = await admin.from("teachers").select("id,department_id,account_status").eq("user_id", userId).eq("account_status", "active").maybeSingle();
    return data ?? null;
  };
  const teacherOwnsOffering = async (offeringId: string) => {
    const teacher = await activeTeacher();
    if (!teacher) return false;
    const [{ data: link }, { data: offering }] = await Promise.all([
      admin.from("offering_teachers").select("course_offering_id").eq("teacher_id", teacher.id).eq("course_offering_id", offeringId).maybeSingle(),
      admin.from("course_offerings").select("id,department_id").eq("id", offeringId).eq("status", "active").maybeSingle(),
    ]);
    const teacherRole = activeRoles.find((row) => row.role === "teacher");
    return Boolean(link && offering && (!teacherRole?.department_id || teacherRole.department_id === teacher.department_id));
  };

  // Student and teacher portal reads are always scoped to the authenticated user.
  if (action === "myResults") {
    if (!isStudent) return send(403, { error: "An active student account is required." });
    const { data: student, error } = await admin.from("students")
      .select("id,student_number,full_name,email,department_id,program_id")
      .eq("user_id", userId).maybeSingle();
    if (error) return send(400, { error: error.message });
    let publishedResults: Record<string, unknown>[] = [];
    if (student) {
      const { data: results, error: resultError } = await admin.from("semester_results").select("*")
        .eq("student_id", student.id).eq("status", "published").order("created_at", { ascending: false });
      if (resultError) return send(400, { error: resultError.message });
      const ids = [...new Set((results ?? []).map((x) => x.academic_term_id))];
      const terms = ids.length ? await admin.from("academic_terms").select("id,term_name").in("id", ids) : { data: [] };
      const names = new Map((terms.data ?? []).map((x) => [x.id, x.term_name]));
      publishedResults = (results ?? []).map((x) => ({ ...x, term_name: names.get(x.academic_term_id) ?? "—" }));
    }

    // Existing demo users can have published component marks in the original RPS roster.
    const { data: legacyStudent, error: legacyError } = await admin.from("rps_students")
      .select("id,user_id,student_number,full_name,email,current_semester,department_id,intake_session_id")
      .eq("user_id", userId).maybeSingle();
    if (legacyError) return send(400, { error: legacyError.message });
    if (!legacyStudent) return send(200, { data: { student, results: publishedResults, legacyResults: [] } });
    const [enrollments, publishedMarks, courses, sessions] = await Promise.all([
      admin.from("rps_enrollments").select("id,course_id,session_id").eq("student_id", legacyStudent.id),
      admin.from("rps_marks").select("*").eq("is_published", true),
      admin.from("rps_courses").select("id,course_code,title,semester,course_type,credits"),
      admin.from("academic_sessions").select("id,name"),
    ]);
    const enrollmentMap = new Map((enrollments.data ?? []).map((x) => [x.id, x]));
    const courseMap = new Map((courses.data ?? []).map((x) => [x.id, x]));
    const sessionMap = new Map((sessions.data ?? []).map((x) => [x.id, x.name]));
    const legacyResults = (publishedMarks.data ?? [])
      .filter((mark) => enrollmentMap.has(mark.enrollment_id))
      .map((mark) => {
        const enrollment = enrollmentMap.get(mark.enrollment_id);
        const course = enrollment ? courseMap.get(enrollment.course_id) : null;
        return {
          id: mark.id, course_code: course?.course_code ?? "—", course_title: course?.title ?? "—",
          semester: course?.semester ?? null, course_type: course?.course_type ?? "theory",
          credits: course?.credits ?? null, session_name: enrollment ? sessionMap.get(enrollment.session_id) ?? "—" : "—",
          assignment_1: mark.assignment_1, assignment_2: mark.assignment_2, assignment_3: mark.assignment_3,
          assignment_4: mark.assignment_4, class_test_1: mark.class_test_1, class_test_2: mark.class_test_2,
          midterm: mark.midterm, final_exam: mark.final_exam, lab_marks: mark.lab_marks,
          published_at: mark.updated_at,
        };
      });
    return send(200, { data: { student: student ?? legacyStudent, results: publishedResults, legacyResults } });
  }

  if (action === "teacherWorkspace") {
    const teacher = await activeTeacher();
    if (!teacher) return send(403, { error: "An active teacher account is required." });
    const { data: teacherRecord } = await admin.from("teachers").select("id,teacher_number,full_name,department_id").eq("id", teacher.id).maybeSingle();
    const { data: links, error: linkError } = await admin.from("offering_teachers").select("course_offering_id").eq("teacher_id", teacher.id);
    if (linkError) return send(400, { error: linkError.message });
    const offeringIds = [...new Set((links ?? []).map((x) => x.course_offering_id))];
    if (!offeringIds.length) return send(200, { data: { teacher: teacherRecord, offerings: [], legacyOfferings: [] } });

    const [offeringResult, assessmentResult, enrollmentResult] = await Promise.all([
      admin.from("course_offerings").select("*").in("id", offeringIds).eq("status", "active"),
      admin.from("assessments").select("id,course_offering_id,category_id,name,max_marks,is_required,status").in("course_offering_id", offeringIds).eq("status", "active").order("created_at"),
      admin.from("course_enrollments").select("id,student_id,course_offering_id,attempt_no,is_repeat").in("course_offering_id", offeringIds).eq("enrollment_status", "enrolled"),
    ]);
    if (offeringResult.error || assessmentResult.error || enrollmentResult.error) {
      const error = offeringResult.error ?? assessmentResult.error ?? enrollmentResult.error;
      return send(400, { error: error.message });
    }
    const offerings = offeringResult.data ?? [], assessments = assessmentResult.data ?? [], enrollments = enrollmentResult.data ?? [];
    const courseIds = [...new Set(offerings.map((x) => x.course_id))], termIds = [...new Set(offerings.map((x) => x.academic_term_id))];
    const enrollmentIds = enrollments.map((x) => x.id), categoryIds = [...new Set(assessments.map((x) => x.category_id))];
    const studentIds = [...new Set(enrollments.map((x) => x.student_id))];
    const [courses, terms, categories, students, marks, results] = await Promise.all([
      courseIds.length ? admin.from("courses").select("id,code,title,credit_hours").in("id", courseIds) : Promise.resolve({ data: [] }),
      termIds.length ? admin.from("academic_terms").select("id,term_name,academic_session_id").in("id", termIds) : Promise.resolve({ data: [] }),
      categoryIds.length ? admin.from("assessment_categories").select("id,label,weight").in("id", categoryIds) : Promise.resolve({ data: [] }),
      studentIds.length ? admin.from("students").select("id,student_number,full_name").in("id", studentIds) : Promise.resolve({ data: [] }),
      enrollmentIds.length ? admin.from("student_marks").select("id,enrollment_id,assessment_id,marks_obtained,status,feedback,updated_at").in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [] }),
      enrollmentIds.length ? admin.from("course_results").select("id,enrollment_id,status,version,total_marks,letter_grade,grade_point").in("enrollment_id", enrollmentIds).order("version", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    const sessionIds = [...new Set((terms.data ?? []).map((x) => x.academic_session_id))];
    const sessionResult = sessionIds.length ? await admin.from("academic_sessions").select("id,name").in("id", sessionIds) : { data: [] };
    const courseMap = new Map((courses.data ?? []).map((x) => [x.id, x])), termMap = new Map((terms.data ?? []).map((x) => [x.id, x]));
    const sessionMap = new Map((sessionResult.data ?? []).map((x) => [x.id, x.name])), categoryMap = new Map((categories.data ?? []).map((x) => [x.id, x]));
    const studentMap = new Map((students.data ?? []).map((x) => [x.id, x])), markMap = new Map((marks.data ?? []).map((x) => [x.enrollment_id + ":" + x.assessment_id, x]));
    const latestResultMap = new Map<string, Record<string, unknown>>();
    for (const result of results.data ?? []) if (!latestResultMap.has(result.enrollment_id)) latestResultMap.set(result.enrollment_id, result);
    const scopedOfferings = offerings.map((offering) => {
      const course = courseMap.get(offering.course_id), term = termMap.get(offering.academic_term_id);
      const offeringAssessments = assessments.filter((a) => a.course_offering_id === offering.id).map((a) => {
        const category = categoryMap.get(a.category_id);
        return { ...a, category_label: category?.label ?? "Assessment", weight: category?.weight ?? 0 };
      });
      const roster = enrollments.filter((en) => en.course_offering_id === offering.id).map((en) => {
        const student = studentMap.get(en.student_id), latest = latestResultMap.get(en.id);
        const locked = Boolean(latest && ["submitted", "under_review", "approved", "published", "locked"].includes(String(latest.status)));
        return {
          enrollment_id: en.id, student_id: en.student_id, student_number: student?.student_number ?? "—",
          student_name: student?.full_name ?? "—", attempt_no: en.attempt_no, is_repeat: en.is_repeat,
          result_status: latest?.status ?? null, locked,
          marks: offeringAssessments.map((assessment) => {
            const saved = markMap.get(en.id + ":" + assessment.id);
            return { assessment_id: assessment.id, assessment_name: assessment.name, category_label: assessment.category_label,
              weight: assessment.weight, max_marks: assessment.max_marks, marks_obtained: saved?.marks_obtained ?? null,
              status: saved?.status ?? "pending", feedback: saved?.feedback ?? null };
          }),
        };
      });
      return { ...offering, course_code: course?.code ?? "—", course_title: course?.title ?? "—",
        credit_hours: course?.credit_hours ?? null, term_name: term?.term_name ?? "—",
        session_name: term ? sessionMap.get(term.academic_session_id) ?? "—" : "—", assessments: offeringAssessments, roster };
    });
    const assignments = await admin.from("rps_teacher_assignments").select("course_id,session_id").eq("teacher_user_id", userId);
    const legacyCourseIds = [...new Set((assignments.data ?? []).map((x) => x.course_id))], legacySessionIds = [...new Set((assignments.data ?? []).map((x) => x.session_id))];
    const [legacyCourses, legacySessions] = await Promise.all([
      legacyCourseIds.length ? admin.from("rps_courses").select("id,course_code,title,semester,course_type,credits").in("id", legacyCourseIds) : Promise.resolve({ data: [] }),
      legacySessionIds.length ? admin.from("academic_sessions").select("id,name").in("id", legacySessionIds) : Promise.resolve({ data: [] }),
    ]);
    const oldCourseMap = new Map((legacyCourses.data ?? []).map((x) => [x.id, x])), oldSessionMap = new Map((legacySessions.data ?? []).map((x) => [x.id, x.name]));
    const legacyOfferings = (assignments.data ?? []).map((a) => ({ ...oldCourseMap.get(a.course_id), session_name: oldSessionMap.get(a.session_id) ?? "—" }));
    return send(200, { data: { teacher: teacherRecord, offerings: scopedOfferings, legacyOfferings } });
  }

  if (action === "teacherSaveMark") {
    const enrollmentId = asText(body.enrollmentId), assessmentId = asText(body.assessmentId), status = asText(body.status || "present");
    if (!isTeacher || !(await activeTeacher())) return send(403, { error: "An active teacher account is required." });
    if (!["pending", "present", "absent", "excused"].includes(status)) return send(400, { error: "Invalid assessment status." });
    const [{ data: enrollment }, { data: assessment }] = await Promise.all([
      admin.from("course_enrollments").select("id,course_offering_id,enrollment_status").eq("id", enrollmentId).maybeSingle(),
      admin.from("assessments").select("id,course_offering_id,max_marks,status").eq("id", assessmentId).maybeSingle(),
    ]);
    if (!enrollment || enrollment.enrollment_status !== "enrolled" || !assessment || assessment.status !== "active" ||
        enrollment.course_offering_id !== assessment.course_offering_id || !(await teacherOwnsOffering(enrollment.course_offering_id))) {
      return send(403, { error: "You can only enter marks for enrolled students in your own active assigned course." });
    }
    const { data: latestResult } = await admin.from("course_results").select("status").eq("enrollment_id", enrollmentId).order("version", { ascending: false }).limit(1).maybeSingle();
    if (latestResult && ["submitted", "under_review", "approved", "published", "locked"].includes(latestResult.status)) {
      return send(409, { error: "These marks are locked because the course result has been submitted for review or finalized." });
    }
    const mark = body.marksObtained === "" || body.marksObtained == null ? null : Number(body.marksObtained);
    if (status === "present" && (mark === null || !Number.isFinite(mark) || mark < 0 || mark > Number(assessment.max_marks))) {
      return send(400, { error: "Enter a valid mark between 0 and " + assessment.max_marks + "." });
    }
    if (status !== "present" && mark !== null) return send(400, { error: "Marks must be blank for pending, absent, or excused assessments." });
    const saved = await caller.from("student_marks").upsert({
      enrollment_id: enrollmentId, assessment_id: assessmentId, marks_obtained: status === "present" ? mark : null,
      status, entered_by: userId, modified_by: userId,
    }, { onConflict: "enrollment_id,assessment_id" });
    if (saved.error) return send(400, { error: saved.error.message });
    return send(200, { success: true });
  }

  if (action === "teacherProcessOffering") {
    const offeringId = asText(body.offeringId);
    if (!(await teacherOwnsOffering(offeringId))) return send(403, { error: "You can only calculate and submit results for your own active assigned course." });
    const processed = await caller.rpc("process_course_offering", { p_course_offering_id: offeringId });
    if (processed.error) return send(400, { error: processed.error.message });
    return send(200, { success: true, ...((processed.data ?? {}) as Record<string, unknown>) });
  }

  if (!(isSuperAdmin || isDepartmentAdmin || isExamController)) return send(403, { error: "Your role does not have access to administrative records." });

  const list = async (resource: string): Promise<unknown> => {
    const [departments, programs, sessions] = await Promise.all([
      admin.from("departments").select("id,code,name,status").order("code"),
      admin.from("programs").select("id,code,name,department_id,status,duration_years,total_semesters").order("code"),
      admin.from("academic_sessions").select("id,name,starts_on,ends_on,status").order("name", { ascending: false }),
    ]);
    if (departments.error || programs.error || sessions.error) throw departments.error ?? programs.error ?? sessions.error;
    const deptMap = new Map((departments.data ?? []).map((x) => [x.id, x]));
    const progMap = new Map((programs.data ?? []).map((x) => [x.id, x]));
    const sessionMap = new Map((sessions.data ?? []).map((x) => [x.id, x]));

    if (resource === "departments") return departments.data ?? [];
    if (resource === "programs") return (programs.data ?? []).filter((x) => canReadRowDepartment(x.department_id)).map((x) => ({
      ...x, department_name: deptMap.get(x.department_id)?.name ?? "—",
    }));
    if (resource === "sessions") return sessions.data ?? [];
    if (resource === "semesters") {
      const { data, error } = await admin.from("semester_definitions").select("*").order("sequence_no");
      if (error) throw error;
      return (data ?? []).filter((x) => canReadRowDepartment(progMap.get(x.program_id)?.department_id))
        .map((x) => ({ ...x, program_name: progMap.get(x.program_id)?.name ?? "—" }));
    }
    if (resource === "terms") {
      const { data, error } = await admin.from("academic_terms").select("*").order("term_name");
      if (error) throw error;
      return (data ?? []).filter((x) => canReadRowDepartment(progMap.get(x.program_id)?.department_id)).map((x) => ({
        ...x, program_name: progMap.get(x.program_id)?.name ?? "—",
        session_name: sessionMap.get(x.academic_session_id)?.name ?? "—",
      }));
    }
    if (resource === "schemes") {
      const { data, error } = await admin.from("assessment_schemes").select("id,name,description,version,is_active").order("name");
      if (error) throw error;
      return data ?? [];
    }
    if (resource === "gradingPolicies") {
      const { data, error } = await admin.from("grading_policies").select("id,name,version,maximum_gpa,is_active").order("name");
      if (error) throw error;
      return data ?? [];
    }
    if (resource === "categories") {
      const { data, error } = await admin.from("assessment_categories").select("id,scheme_id,label,weight,is_required").order("sort_order");
      if (error) throw error;
      return data ?? [];
    }
    if (resource === "students") {
      const { data, error } = await admin.from("students").select("*").order("student_number");
      if (error) throw error;
      return (data ?? []).filter((x) => canReadRowDepartment(x.department_id)).map((x) => ({
        ...x, department_name: deptMap.get(x.department_id)?.name ?? "—",
        program_name: progMap.get(x.program_id)?.name ?? "—",
        session_name: sessionMap.get(x.intake_session_id)?.name ?? "—",
        has_login: Boolean(x.user_id),
      }));
    }
    if (resource === "teachers") {
      const { data, error } = await admin.from("teachers").select("*").order("teacher_number");
      if (error) throw error;
      return (data ?? []).filter((x) => canReadRowDepartment(x.department_id)).map((x) => ({ ...x, department_name: deptMap.get(x.department_id)?.name ?? "—", has_login: Boolean(x.user_id) }));
    }
    if (resource === "courses") {
      const { data, error } = await admin.from("courses").select("*").order("code");
      if (error) throw error;
      return (data ?? []).filter((x) => canReadRowDepartment(progMap.get(x.program_id)?.department_id))
        .map((x) => ({ ...x, program_name: progMap.get(x.program_id)?.name ?? "—" }));
    }
    if (resource === "offerings") {
      const { data, error } = await admin.from("course_offerings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const cids = [...new Set((data ?? []).map((x) => x.course_id))];
      const tids = [...new Set((data ?? []).map((x) => x.academic_term_id))];
      const [courses, terms] = await Promise.all([
        cids.length ? admin.from("courses").select("id,code,title").in("id", cids) : Promise.resolve({ data: [] }),
        tids.length ? admin.from("academic_terms").select("id,term_name").in("id", tids) : Promise.resolve({ data: [] }),
      ]);
      const cm = new Map((courses.data ?? []).map((x) => [x.id, x]));
      const tm = new Map((terms.data ?? []).map((x) => [x.id, x.term_name]));
      return (data ?? []).filter((x) => canReadRowDepartment(x.department_id)).map((x) => ({
        ...x, course_code: cm.get(x.course_id)?.code ?? "—", course_title: cm.get(x.course_id)?.title ?? "—",
        term_name: tm.get(x.academic_term_id) ?? "—", department_name: deptMap.get(x.department_id)?.name ?? "—",
      }));
    }
    if (resource === "assessments") {
      const { data, error } = await admin.from("assessments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const cids = [...new Set((data ?? []).map((x) => x.category_id))];
      const oids = [...new Set((data ?? []).map((x) => x.course_offering_id))];
      const [categories, offerings] = await Promise.all([
        cids.length ? admin.from("assessment_categories").select("id,label,weight").in("id", cids) : Promise.resolve({ data: [] }),
        oids.length ? admin.from("course_offerings").select("id,course_id,department_id").in("id", oids) : Promise.resolve({ data: [] }),
      ]);
      const courseIds = [...new Set((offerings.data ?? []).map((x) => x.course_id))];
      const courses = courseIds.length ? await admin.from("courses").select("id,code").in("id", courseIds) : { data: [] };
      const catMap = new Map((categories.data ?? []).map((x) => [x.id, x]));
      const offMap = new Map((offerings.data ?? []).map((x) => [x.id, x]));
      const courseMap = new Map((courses.data ?? []).map((x) => [x.id, x.code]));
      return (data ?? []).map((x) => {
        const off = offMap.get(x.course_offering_id);
        return { ...x, department_id: off?.department_id ?? null,
          category_label: catMap.get(x.category_id)?.label ?? "—", course_code: off ? courseMap.get(off.course_id) ?? "—" : "—" };
      }).filter((x) => canReadRowDepartment(x.department_id));
    }
    if (resource === "marks") {
      const [enrollments, marks, assessments, students, offerings, courses] = await Promise.all([
        admin.from("course_enrollments").select("*"),
        admin.from("student_marks").select("*"),
        admin.from("assessments").select("id,name,max_marks,course_offering_id"),
        admin.from("students").select("id,student_number,full_name"),
        admin.from("course_offerings").select("id,course_id,department_id"),
        admin.from("courses").select("id,code,title"),
      ]);
      const studentMap = new Map((students.data ?? []).map((x) => [x.id, x]));
      const offeringMap = new Map((offerings.data ?? []).map((x) => [x.id, x]));
      const courseMap = new Map((courses.data ?? []).map((x) => [x.id, x]));
      const markMap = new Map((marks.data ?? []).map((x) => [x.enrollment_id + ":" + x.assessment_id, x]));
      const rows: Record<string, unknown>[] = [];
      for (const en of enrollments.data ?? []) {
        const student = studentMap.get(en.student_id);
        const offering = offeringMap.get(en.course_offering_id);
        const course = offering ? courseMap.get(offering.course_id) : null;
        for (const a of (assessments.data ?? []).filter((x) => x.course_offering_id === en.course_offering_id)) {
          const mark = markMap.get(en.id + ":" + a.id);
          if (offering && canReadRowDepartment(offering.department_id)) rows.push({
            enrollment_id: en.id, assessment_id: a.id, department_id: offering.department_id,
            student_name: student?.full_name ?? "—", student_number: student?.student_number ?? "—",
            course_code: course?.code ?? "—", assessment_name: a.name, max_marks: a.max_marks,
            marks_obtained: mark?.marks_obtained ?? null, status: mark?.status ?? "pending" });
        }
      }
      return rows;
    }
    if (resource === "courseResults") {
      const [results, enrollments, students, offerings, courses] = await Promise.all([
        admin.from("course_results").select("*").order("created_at", { ascending: false }),
        admin.from("course_enrollments").select("id,student_id,course_offering_id"),
        admin.from("students").select("id,student_number,full_name"),
        admin.from("course_offerings").select("id,course_id,academic_term_id,department_id"),
        admin.from("courses").select("id,code,title"),
      ]);
      const em = new Map((enrollments.data ?? []).map((x) => [x.id, x]));
      const sm = new Map((students.data ?? []).map((x) => [x.id, x]));
      const om = new Map((offerings.data ?? []).map((x) => [x.id, x]));
      const cm = new Map((courses.data ?? []).map((x) => [x.id, x]));
      return (results.data ?? []).map((x) => {
        const en = em.get(x.enrollment_id);
        const st = en ? sm.get(en.student_id) : null;
        const off = en ? om.get(en.course_offering_id) : null;
        const course = off ? cm.get(off.course_id) : null;
        return { ...x, department_id: off?.department_id ?? null, student_name: st?.full_name ?? "—",
          student_number: st?.student_number ?? "—", course_code: course?.code ?? "—", course_title: course?.title ?? "—" };
      }).filter((x) => canReadRowDepartment(x.department_id));
    }
    if (resource === "results") {
      const [results, students, terms] = await Promise.all([
        admin.from("semester_results").select("*").order("created_at", { ascending: false }),
        admin.from("students").select("id,student_number,full_name,email,department_id"),
        admin.from("academic_terms").select("id,term_name,academic_session_id"),
      ]);
      const sessionIds = [...new Set((terms.data ?? []).map((x) => x.academic_session_id))];
      const sessionRows = sessionIds.length ? await admin.from("academic_sessions").select("id,name").in("id", sessionIds) : { data: [] };
      const sm = new Map((students.data ?? []).map((x) => [x.id, x]));
      const tm = new Map((terms.data ?? []).map((x) => [x.id, x]));
      const sessm = new Map((sessionRows.data ?? []).map((x) => [x.id, x.name]));
      return (results.data ?? []).map((x) => {
        const s = sm.get(x.student_id);
        const t = tm.get(x.academic_term_id);
        return { ...x, department_id: s?.department_id ?? null, student_name: s?.full_name ?? "—",
          student_number: s?.student_number ?? "—", email: s?.email ?? "", term_name: t?.term_name ?? "—",
          session_name: t ? sessm.get(t.academic_session_id) ?? "—" : "—" };
      }).filter((x) => canReadRowDepartment(x.department_id));
    }
    throw new Error("Unknown module.");
  };

  try {
    if (action === "list") return send(200, { data: await list(asText(body.resource)) });

    if (action === "setPersonStatus") {
      const type = body.accountType === "teacher" ? "teacher" : body.accountType === "student" ? "student" : null;
      const id = asText(body.personId);
      const status = asText(body.status);
      if (!type || !id || !["active", "inactive", "archived"].includes(status)) return send(400, { error: "Invalid status update." });
      if (!(isSuperAdmin || isDepartmentAdmin)) return send(403, { error: "Only Super Administrators or Department Administrators can manage accounts." });
      const table = type === "student" ? "students" : "teachers";
      const { data: target } = await admin.from(table).select("id,department_id").eq("id", id).maybeSingle();
      if (!target || !canManageDepartment(target.department_id)) return send(403, { error: "You cannot manage accounts outside your department." });
      const updated = await admin.from(table).update({ account_status: status }).eq("id", id).select("user_id").single();
      if (updated.error) return send(400, { error: updated.error.message });
      if (updated.data.user_id) {
        const active = status === "active";
        await admin.from("profiles").update({ is_active: active, account_status: active ? "active" : "disabled" }).eq("id", updated.data.user_id);
        await admin.from("user_roles").update({ is_active: active }).eq("user_id", updated.data.user_id);
      }
      return send(200, { success: true });
    }

    if (action === "saveRecord") {
      const resource = asText(body.resource);
      const record = body.record && typeof body.record === "object" ? body.record : {};
      const id = asText(record.id);
      const allowed: Record<string, { table: string; fields: string[] }> = {
        departments: { table: "departments", fields: ["code", "name", "description", "status"] },
        programs: { table: "programs", fields: ["department_id", "code", "name", "duration_years", "total_semesters", "status"] },
        sessions: { table: "academic_sessions", fields: ["name", "starts_on", "ends_on", "status"] },
        semesters: { table: "semester_definitions", fields: ["program_id", "name", "sequence_no", "status"] },
        terms: { table: "academic_terms", fields: ["program_id", "academic_session_id", "semester_definition_id", "term_name", "starts_on", "ends_on", "status"] },
        courses: { table: "courses", fields: ["program_id", "code", "title", "description", "credit_hours", "is_credit_bearing", "status"] },
        offerings: { table: "course_offerings", fields: ["course_id", "department_id", "program_id", "academic_term_id", "assessment_scheme_id", "grading_policy_id", "section", "status"] },
        assessments: { table: "assessments", fields: ["course_offering_id", "category_id", "name", "max_marks", "assessment_date", "is_required", "status"] },
      };
      const schema = allowed[resource];
      if (!schema) return send(400, { error: "Creation is not enabled for this module." });
      if (isExamController) return send(403, { error: "Examination Controllers have read and approval access, not academic-record editing access." });
      if (!isSuperAdmin && !(isDepartmentAdmin && ["programs", "semesters", "terms", "courses", "offerings", "assessments"].includes(resource))) {
        return send(403, { error: "This role cannot edit the selected academic resource." });
      }
      const payload: Record<string, unknown> = {};
      for (const field of schema.fields) if (record[field] !== undefined) payload[field] = record[field];
      let departmentId: string | null = null;
      if (resource === "programs" || resource === "offerings") {
        departmentId = asText(record.department_id) || null;
        if (!departmentId && id) {
          const table = resource === "programs" ? "programs" : "course_offerings";
          const { data: current } = await admin.from(table).select("department_id").eq("id", id).maybeSingle();
          departmentId = current?.department_id ?? null;
        }
      } else if (["semesters", "terms", "courses"].includes(resource)) {
        const existing = id && !record.program_id ? await admin.from(schema.table).select("program_id").eq("id", id).maybeSingle() : { data: null };
        const programId = asText(record.program_id) || existing.data?.program_id;
        if (programId) {
          const { data: program } = await admin.from("programs").select("department_id").eq("id", programId).maybeSingle();
          departmentId = program?.department_id ?? null;
        }
      } else if (resource === "assessments") {
        const existing = id && !record.course_offering_id ? await admin.from("assessments").select("course_offering_id").eq("id", id).maybeSingle() : { data: null };
        const offeringId = asText(record.course_offering_id) || existing.data?.course_offering_id;
        if (offeringId) {
          const { data: offering } = await admin.from("course_offerings").select("department_id").eq("id", offeringId).maybeSingle();
          departmentId = offering?.department_id ?? null;
        }
      }
      if (!isSuperAdmin && !canManageDepartment(departmentId)) return send(403, { error: "You cannot edit records outside your department." });
      const query = id
        ? await admin.from(schema.table).update(payload).eq("id", id).select("*").single()
        : await admin.from(schema.table).insert(payload).select("*").single();
      if (query.error) return send(400, { error: query.error.message });
      return send(200, { success: true, data: query.data });
    }

    if (action === "saveMark") {
      if (!(isSuperAdmin || isDepartmentAdmin)) return send(403, { error: "Only Super Administrators and Department Administrators can enter marks here. Teachers use the Teacher portal." });
      const enrollmentId = asText(body.enrollmentId);
      const assessmentId = asText(body.assessmentId);
      const status = asText(body.status || "present");
      const [{ data: enrollment }, { data: assessment }] = await Promise.all([
        admin.from("course_enrollments").select("id,course_offering_id").eq("id", enrollmentId).maybeSingle(),
        admin.from("assessments").select("id,course_offering_id,max_marks").eq("id", assessmentId).maybeSingle(),
      ]);
      if (!enrollment || !assessment || enrollment.course_offering_id !== assessment.course_offering_id) {
        return send(400, { error: "The assessment does not belong to this student's course." });
      }
      const { data: offering } = await admin.from("course_offerings").select("department_id").eq("id", enrollment.course_offering_id).maybeSingle();
      if (!offering || !canManageDepartment(offering.department_id)) return send(403, { error: "You cannot enter marks outside your department." });
      const { data: latestResult } = await admin.from("course_results").select("status").eq("enrollment_id", enrollmentId).order("version", { ascending: false }).limit(1).maybeSingle();
      if (latestResult && ["submitted", "under_review", "approved", "published", "locked"].includes(latestResult.status)) return send(409, { error: "These marks are locked because the course result is under review or finalized." });
      if (!["pending", "present", "absent", "excused"].includes(status)) return send(400, { error: "Invalid mark status." });
      const mark = body.marksObtained === "" || body.marksObtained == null ? null : Number(body.marksObtained);
      if (status === "present" && (mark === null || !Number.isFinite(mark) || mark < 0 || mark > Number(assessment.max_marks))) {
        return send(400, { error: "Enter marks between 0 and the assessment maximum." });
      }
      const result = await caller.from("student_marks").upsert({
        enrollment_id: enrollmentId, assessment_id: assessmentId,
        marks_obtained: status === "present" ? mark : null, status,
        entered_by: userId, modified_by: userId,
      }, { onConflict: "enrollment_id,assessment_id" });
      if (result.error) return send(400, { error: result.error.message });
      return send(200, { success: true });
    }

    if (action === "assignTeacher") {
      if (!(isSuperAdmin || isDepartmentAdmin)) return send(403, { error: "Only Super Administrators and Department Administrators can assign teachers." });
      const offeringId = asText(body.offeringId), teacherId = asText(body.teacherId);
      const [{ data: offering }, { data: teacher }] = await Promise.all([
        admin.from("course_offerings").select("id,department_id").eq("id", offeringId).maybeSingle(),
        admin.from("teachers").select("id,department_id,account_status").eq("id", teacherId).maybeSingle(),
      ]);
      if (!offering || !teacher || teacher.account_status !== "active" || offering.department_id !== teacher.department_id || !canManageDepartment(offering.department_id)) {
        return send(403, { error: "Choose an active teacher and course offering in your department." });
      }
      const result = await admin.from("offering_teachers").upsert({
        course_offering_id: offeringId, teacher_id: teacherId, assigned_by: userId,
      }, { onConflict: "course_offering_id,teacher_id" });
      if (result.error) return send(400, { error: result.error.message });
      return send(200, { success: true });
    }

    if (action === "processOffering") {
      if (!isSuperAdmin) return send(403, { error: "Teachers should calculate and submit from their own Teacher portal." });
      const processed = await caller.rpc("process_course_offering", { p_course_offering_id: asText(body.offeringId) });
      if (processed.error) return send(400, { error: processed.error.message });
      return send(200, { success: true, ...((processed.data ?? {}) as Record<string, unknown>) });
    }

    if (action === "approveResult") {
      if (!(isSuperAdmin || isExamController)) return send(403, { error: "Only the Super Administrator or Examination Controller can approve course results." });
      const resultId = asText(body.resultId);
      if (isExamController && !isSuperAdmin && !hasGlobalExamScope) {
        const { data: resultRow } = await admin.from("course_results").select("enrollment_id").eq("id", resultId).maybeSingle();
        const { data: enrollment } = resultRow ? await admin.from("course_enrollments").select("course_offering_id").eq("id", resultRow.enrollment_id).maybeSingle() : { data: null };
        const { data: offering } = enrollment ? await admin.from("course_offerings").select("department_id").eq("id", enrollment.course_offering_id).maybeSingle() : { data: null };
        if (!offering || !departmentScopes.includes(offering.department_id)) return send(403, { error: "You can only approve results for your assigned department." });
      }
      const result = await caller.rpc("approve_course_result", { p_course_result_id: resultId });
      if (result.error) return send(400, { error: result.error.message });
      return send(200, { success: true });
    }

    return send(400, { error: "Unsupported action." });
  } catch (error) {
    return send(500, { error: error instanceof Error ? error.message : "Unexpected admin data error." });
  }
});
