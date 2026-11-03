"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginState = { error?: string };

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }
  if (!hasSupabaseEnv()) return { error: "Supabase is not configured. Add your project URL and publishable key to .env.local." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Sign-in failed. Check your email and password." };

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") return { error: "Could not verify the signed-in account." };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (roles?.some((item) => item.role === "student")) redirect("/student/dashboard");
  if (roles?.some((item) => item.role === "teacher")) redirect("/teacher/dashboard");
  if (roles?.some((item) => ["super_admin", "department_admin", "exam_controller"].includes(item.role))) redirect("/admin/dashboard");

  return { error: "This account has no active application role. Contact your administrator." };
}
