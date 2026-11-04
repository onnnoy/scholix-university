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

  // Student and teacher portal reads are always scoped to the authenticated user.
  if (action === "myResults") {
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
    const { data: teacher, error } = await admin.from("teachers")
      .select("id,teacher_number,full_name,department_id").eq("user_id", userId).maybeSingle();
    if (error) return send(400, { error: error.message });
    if (!teacher) {
      const { data: legacyTeacher, error: legacyTeacherError } = await admin.from("rps_teachers")
        .select("user_id,teacher_number,full_name,department_id").eq("user_id", userId).maybeSingle();
      if (legacyTeacherError) return send(400, { error: legacyTeacherError.message });
      if (!legacyTeacher) return send(200, { data: { teacher: null, offerings: [] } });
    }
    const activeTeacher = teacher;
    const links = activeTeacher
      ? await admin.from("offering_teachers").select("course_offering_id").eq("teacher_id", activeTeacher.id)
      : { data: [], error: null };
    if (links.error) return send(400, { error: links.error.message });
    const modernOfferingIds = (links.data ?? []).map((x) => x.course_offering_id);
    let modernOfferings: Record<string, unknown>[] = [];
    if (modernOfferingIds.length) {
      const { data: offeringRows, error: offeringError } = await admin.from("course_offerings").select("*").in("id", modernOfferingIds);
      if (offeringError) return send(400, { error: offeringError.message });
      const courseIds = [...new Set((offeringRows ?? []).map((x) => x.course_id))];
      const courses = courseIds.length ? await admin.from("courses").select("id,code,title").in("id", courseIds) : { data: [] };
      const courseMap = new Map((courses.data ?? []).map((x) => [x.id, x]));
      modernOfferings = (offeringRows ?? []).map((x) => ({
        ...x, course_code: courseMap.get(x.course_id)?.code ?? "—",
        course_title: courseMap.get(x.course_id)?.title ?? "—",
      }));
    }
    const legacyTeacher = await admin.from("rps_teachers")
      .select("user_id,teacher_number,full_name,department_id").eq("user_id", userId).maybeSingle();
    const assignments = await admin.from("rps_teacher_assignments").select("course_id,session_id").eq("teacher_user_id", userId);
    const courseIds = [...new Set((assignments.data ?? []).map((x) => x.course_id))];
    const sessionIds = [...new Set((assignments.data ?? []).map((x) => x.session_id))];
    const [legacyCourses, legacySessions] = await Promise.all([
      courseIds.length ? admin.from("rps_courses").select("id,course_code,title,semester,course_type,credits").in("id", courseIds) : Promise.resolve({ data: [] }),
      sessionIds.length ? admin.from("academic_sessions").select("id,name").in("id", sessionIds) : Promise.resolve({ data: [] }),
    ]);
    const oldCourseMap = new Map((legacyCourses.data ?? []).map((x) => [x.id, x]));
    const sessionMap = new Map((legacySessions.data ?? []).map((x) => [x.id, x.name]));
    const legacyOfferings = (assignments.data ?? []).map((x) => ({
      ...oldCourseMap.get(x.course_id), session_name: sessionMap.get(x.session_id) ?? "—",
    }));
    return send(200, { data: { teacher: activeTeacher ?? legacyTeacher.data, offerings: [...modernOfferings, ...legacyOfferings] } });
    if (links.error) return send(400, { error: links.error.message });
    const offeringIds = (links.data ?? []).map((x) => x.course_offering_id);
    const offerings = offeringIds.length
      ? await admin.from("course_offerings").select("*").in("id", offeringIds)
      : { data: [], error: null };
    if (offerings.error) return send(400, { error: offerings.error.message });
    const courseIds = [...new Set((offerings.data ?? []).map((x) => x.course_id))];
    const courses = courseIds.length ? await admin.from("courses").select("id,code,title").in("id", courseIds) : { data: [] };
    const courseMap = new Map((courses.data ?? []).map((x) => [x.id, x]));
    return send(200, { data: { teacher, offerings: (offerings.data ?? []).map((x) => ({
      ...x, course_code: courseMap.get(x.course_id)?.code ?? "—", course_title: courseMap.get(x.course_id)?.title ?? "—",
    })) } });
  }

  const [profile, role] = await Promise.all([
    admin.from("profiles").select("account_status,is_active").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("id").eq("user_id", userId).eq("role", "super_admin").eq("is_active", true).maybeSingle(),
  ]);
  if (!role.data || !profile.data || profile.data.account_status !== "active" || profile.data.is_active !== true) {
    return send(403, { error: "Only an active super administrator can access this module." });
  }

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
    if (resource === "programs") return (programs.data ?? []).map((x) => ({
      ...x, department_name: deptMap.get(x.department_id)?.name ?? "—",
    }));
    if (resource === "sessions") return sessions.data ?? [];
    if (resource === "semesters") {
      const { data, error } = await admin.from("semester_definitions").select("*").order("sequence_no");
      if (error) throw error;
      return (data ?? []).map((x) => ({ ...x, program_name: progMap.get(x.program_id)?.name ?? "—" }));
    }
    if (resource === "terms") {
      const { data, error } = await admin.from("academic_terms").select("*").order("term_name");
      if (error) throw error;
      return (data ?? []).map((x) => ({
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
      return (data ?? []).map((x) => ({
        ...x, department_name: deptMap.get(x.department_id)?.name ?? "—",
        program_name: progMap.get(x.program_id)?.name ?? "—",
        session_name: sessionMap.get(x.intake_session_id)?.name ?? "—",
        has_login: Boolean(x.user_id),
      }));
    }
    if (resource === "teachers") {
      const { data, error } = await admin.from("teachers").select("*").order("teacher_number");
      if (error) throw error;
      return (data ?? []).map((x) => ({ ...x, department_name: deptMap.get(x.department_id)?.name ?? "—", has_login: Boolean(x.user_id) }));
    }
    if (resource === "courses") {
      const { data, error } = await admin.from("courses").select("*").order("code");
      if (error) throw error;
      return (data ?? []).map((x) => ({ ...x, program_name: progMap.get(x.program_id)?.name ?? "—" }));
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
      return (data ?? []).map((x) => ({
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
        oids.length ? admin.from("course_offerings").select("id,course_id").in("id", oids) : Promise.resolve({ data: [] }),
      ]);
      const courseIds = [...new Set((offerings.data ?? []).map((x) => x.course_id))];
      const courses = courseIds.length ? await admin.from("courses").select("id,code").in("id", courseIds) : { data: [] };
      const catMap = new Map((categories.data ?? []).map((x) => [x.id, x]));
      const offMap = new Map((offerings.data ?? []).map((x) => [x.id, x]));
      const courseMap = new Map((courses.data ?? []).map((x) => [x.id, x.code]));
      return (data ?? []).map((x) => {
        const off = offMap.get(x.course_offering_id);
        return { ...x, category_label: catMap.get(x.category_id)?.label ?? "—", course_code: off ? courseMap.get(off.course_id) ?? "—" : "—" };
      });
    }
    if (resource === "marks") {
      const [enrollments, marks, assessments, students, offerings, courses] = await Promise.all([
        admin.from("course_enrollments").select("*"),
        admin.from("student_marks").select("*"),
        admin.from("assessments").select("id,name,max_marks,course_offering_id"),
        admin.from("students").select("id,student_number,full_name"),
        admin.from("course_offerings").select("id,course_id"),
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
          rows.push({ enrollment_id: en.id, assessment_id: a.id, student_name: student?.full_name ?? "—",
            student_number: student?.student_number ?? "—", course_code: course?.code ?? "—",
            assessment_name: a.name, max_marks: a.max_marks, marks_obtained: mark?.marks_obtained ?? null,
            status: mark?.status ?? "pending" });
        }
      }
      return rows;
    }
    if (resource === "courseResults") {
      const [results, enrollments, students, offerings, courses] = await Promise.all([
        admin.from("course_results").select("*").order("created_at", { ascending: false }),
        admin.from("course_enrollments").select("id,student_id,course_offering_id"),
        admin.from("students").select("id,student_number,full_name"),
        admin.from("course_offerings").select("id,course_id,academic_term_id"),
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
        return { ...x, student_name: st?.full_name ?? "—", student_number: st?.student_number ?? "—",
          course_code: course?.code ?? "—", course_title: course?.title ?? "—" };
      });
    }
    if (resource === "results") {
      const [results, students, terms] = await Promise.all([
        admin.from("semester_results").select("*").order("created_at", { ascending: false }),
        admin.from("students").select("id,student_number,full_name,email"),
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
        return { ...x, student_name: s?.full_name ?? "—", student_number: s?.student_number ?? "—",
          email: s?.email ?? "", term_name: t?.term_name ?? "—",
          session_name: t ? sessm.get(t.academic_session_id) ?? "—" : "—" };
      });
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
      const table = type === "student" ? "students" : "teachers";
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
      const payload: Record<string, unknown> = {};
      for (const field of schema.fields) if (record[field] !== undefined) payload[field] = record[field];
      const query = id
        ? await admin.from(schema.table).update(payload).eq("id", id).select("*").single()
        : await admin.from(schema.table).insert(payload).select("*").single();
      if (query.error) return send(400, { error: query.error.message });
      return send(200, { success: true, data: query.data });
    }

    if (action === "saveMark") {
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
      if (!["pending", "present", "absent", "excused"].includes(status)) return send(400, { error: "Invalid mark status." });
      const mark = body.marksObtained === "" || body.marksObtained == null ? null : Number(body.marksObtained);
      if (status === "present" && (mark === null || !Number.isFinite(mark) || mark < 0 || mark > Number(assessment.max_marks))) {
        return send(400, { error: "Enter marks between 0 and the assessment maximum." });
      }
      const result = await admin.from("student_marks").upsert({
        enrollment_id: enrollmentId, assessment_id: assessmentId,
        marks_obtained: status === "present" ? mark : null, status,
        entered_by: userId, modified_by: userId,
      }, { onConflict: "enrollment_id,assessment_id" });
      if (result.error) return send(400, { error: result.error.message });
      return send(200, { success: true });
    }

    if (action === "assignTeacher") {
      const result = await admin.from("offering_teachers").upsert({
        course_offering_id: asText(body.offeringId), teacher_id: asText(body.teacherId), assigned_by: userId,
      }, { onConflict: "course_offering_id,teacher_id" });
      if (result.error) return send(400, { error: result.error.message });
      return send(200, { success: true });
    }

    if (action === "processOffering") {
      const offeringId = asText(body.offeringId);
      const { data: enrollments, error } = await admin.from("course_enrollments").select("id")
        .eq("course_offering_id", offeringId).eq("enrollment_status", "enrolled");
      if (error) return send(400, { error: error.message });
      if (!enrollments?.length) return send(400, { error: "No active student enrollments for this offering." });
      const resultIds: string[] = [];
      for (const enrollment of enrollments) {
        const calculated = await caller.rpc("calculate_course_result", { p_enrollment_id: enrollment.id });
        if (calculated.error || !calculated.data) return send(400, { error: calculated.error?.message ?? "Calculation failed.", processedCount: resultIds.length });
        const submitted = await caller.rpc("submit_course_result", { p_course_result_id: calculated.data });
        if (submitted.error) return send(400, { error: submitted.error.message, processedCount: resultIds.length });
        resultIds.push(calculated.data);
      }
      return send(200, { success: true, processedCount: resultIds.length });
    }

    if (action === "approveResult") {
      const result = await caller.rpc("approve_course_result", { p_course_result_id: asText(body.resultId) });
      if (result.error) return send(400, { error: result.error.message });
      return send(200, { success: true });
    }

    return send(400, { error: "Unsupported action." });
  } catch (error) {
    return send(500, { error: error instanceof Error ? error.message : "Unexpected admin data error." });
  }
});
