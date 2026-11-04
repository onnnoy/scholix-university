import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !anon || !service || !authorization) return json(500, { error: "Account service is unavailable." });

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json(401, { error: "Please sign in again." });

  const [{ data: role }, { data: profile }] = await Promise.all([
    userClient.from("user_roles").select("id").eq("user_id", auth.user.id).eq("role", "super_admin").eq("is_active", true).maybeSingle(),
    userClient.from("profiles").select("is_active,account_status").eq("id", auth.user.id).maybeSingle(),
  ]);
  if (!role || profile?.is_active !== true || profile.account_status !== "active") {
    return json(403, { error: "Only an active super administrator can create accounts." });
  }

  const body = await req.json().catch(() => null);
  if (!body || !["student", "teacher"].includes(body.accountType)) return json(400, { error: "Invalid account type." });

  const accountType = body.accountType as "student" | "teacher";
  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const number = String(body.personNumber ?? "").trim();
  const departmentId = String(body.departmentId ?? "");
  if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || number.length < 3 || !departmentId) {
    return json(400, { error: "Enter a valid name, email, ID number and department." });
  }

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: department } = await admin.from("departments").select("id").eq("id", departmentId).maybeSingle();
  if (!department) return json(400, { error: "Choose a valid department." });

  const programId = String(body.programId ?? "");
  const sessionId = String(body.sessionId ?? "");
  if (accountType === "student") {
    const [{ data: program }, { data: session }] = await Promise.all([
      admin.from("programs").select("id,department_id").eq("id", programId).maybeSingle(),
      admin.from("academic_sessions").select("id").eq("id", sessionId).maybeSingle(),
    ]);
    if (!program || program.department_id !== departmentId || !session) {
      return json(400, { error: "Choose a valid program and intake session." });
    }
  }

  const password = "Scholix-" + crypto.randomUUID().replaceAll("-", "").slice(0, 12) + "!";
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) return json(400, { error: createError?.message ?? "Account creation failed." });

  const newUserId = created.user.id;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: newUserId, full_name: fullName, email, is_active: true, account_status: "active",
  });
  if (profileError) return json(500, { error: "Profile creation failed: " + profileError.message });

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: newUserId, role: accountType, department_id: accountType === "teacher" ? departmentId : null,
    created_by: auth.user.id, is_active: true,
  });
  if (roleError) return json(500, { error: "Role creation failed: " + roleError.message });

  const table = accountType === "student" ? "students" : "teachers";
  const record = accountType === "student"
    ? { user_id: newUserId, student_number: number, full_name: fullName, email, department_id: departmentId,
        program_id: programId, intake_session_id: sessionId, academic_status: "active", account_status: "active" }
    : { user_id: newUserId, teacher_number: number, full_name: fullName, email, department_id: departmentId, account_status: "active" };
  const { data: createdRecord, error: recordError } = await admin.from(table).insert(record).select("id").single();
  if (recordError) return json(500, { error: "Academic record creation failed: " + recordError.message });

  let enrolledCount = 0;
  if (accountType === "student") {
    const { data: terms, error: termError } = await admin.from("academic_terms").select("id")
      .eq("program_id", programId).eq("academic_session_id", sessionId).eq("status", "active").limit(1);
    if (termError) return json(500, { error: "Academic term lookup failed: " + termError.message });
    if (terms?.[0]) {
      const { data: offerings, error: offeringError } = await admin.from("course_offerings").select("id")
        .eq("academic_term_id", terms[0].id).eq("status", "active");
      if (offeringError) return json(500, { error: "Course offering lookup failed: " + offeringError.message });
      if (offerings?.length) {
        const { error: enrollmentError } = await admin.from("course_enrollments").insert(
          offerings.map((offering) => ({
            student_id: createdRecord.id, course_offering_id: offering.id,
            enrollment_status: "enrolled", attempt_no: 1, is_repeat: false,
          })),
        );
        if (enrollmentError) return json(500, { error: "Student course enrollment failed: " + enrollmentError.message });
        enrolledCount = offerings.length;
      }
    }
  }

  return json(200, { success: true, accountType, email, password, recordId: createdRecord.id, enrolledCount });
});
