import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default function HomePage() {
  redirect(process.env.DEMO_MODE === "true" && !hasSupabaseEnv() ? "/admin/dashboard" : "/login");
}
