import "server-only";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export type AccessContext = {
  userId: string | null;
  roles: { role: AppRole; department_id: string | null }[];
  demo: boolean;
};

const ADMIN_ROLES: AppRole[] = ["super_admin", "department_admin", "exam_controller"];

export async function getAccessContext(): Promise<AccessContext> {
  const demo = process.env.DEMO_MODE === "true" && !hasSupabaseEnv();
  if (demo) {
    return {
      userId: null,
      roles: [{ role: "super_admin", department_id: null }],
      demo: true,
    };
  }

  if (!hasSupabaseEnv()) return { userId: null, roles: [], demo: false };

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string") return { userId: null, roles: [], demo: false };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active,account_status")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile || profile.is_active !== true || profile.account_status !== "active") return { userId, roles: [], demo: false };

  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, department_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (rolesError || !roleRows) return { userId, roles: [], demo: false };
  return { userId, roles: roleRows, demo: false };
}

export async function requireAdminAccess() {
  const context = await getAccessContext();
  if (context.demo) return context;
  if (!context.userId) redirect("/login");
  if (!context.roles.some(({ role }) => ADMIN_ROLES.includes(role))) redirect("/login?error=not_authorized");
  return context;
}

export async function requirePortalRole(requiredRole: AppRole) {
  const context = await getAccessContext();
  if (context.demo) {
    if (requiredRole === "super_admin") return context;
    redirect("/login?error=not_authorized");
  }
  if (!context.userId) redirect("/login");
  if (!context.roles.some(({ role }) => role === requiredRole)) redirect("/login?error=not_authorized");
  return context;
}
