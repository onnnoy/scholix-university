import { AlertCircle } from "lucide-react";
import { AcademicDashboard, demoDashboardData, emptyDashboardData } from "@/components/academic-dashboard";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { dashboardSummarySchema, formatDashboardSummary } from "@/features/dashboard/schema";

export const metadata = { title: "Dashboard" };



export default async function AdminDashboardPage() {
  const demoMode = process.env.DEMO_MODE === "true" && !hasSupabaseEnv();
  if (demoMode) return <AcademicDashboard data={demoDashboardData} isDemo />;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard_summary");

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4f7f5] p-6">
        <div className="mx-auto mt-10 flex max-w-2xl gap-3 rounded-xl border border-rose-100 bg-white p-5 text-sm text-rose-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">Dashboard data could not be loaded.</p><p className="mt-1 text-xs leading-5 text-rose-600">{error.message}. Confirm the database migration has been applied and your account has an administrator role.</p></div>
        </div>
      </main>
    );
  }

  const summary = dashboardSummarySchema.safeParse(data);
  if (!summary.success) {
    return <AcademicDashboard data={emptyDashboardData} />;
  }

  const liveData = {
    ...emptyDashboardData,
    stats: formatDashboardSummary(summary.data),
  };

  return <AcademicDashboard data={liveData} />;
}
