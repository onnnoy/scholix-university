import Link from "next/link";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  const demoMode = process.env.DEMO_MODE === "true" && !hasSupabaseEnv();

  return (
    <main className="grid min-h-screen bg-[#f4f7f5] lg:grid-cols-[1fr_460px]">
      <section className="relative hidden overflow-hidden bg-[#eef8f0] p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 -top-20 size-[440px] rounded-full border border-emerald-100" />
        <div className="absolute -bottom-36 -left-28 size-[520px] rounded-full border border-emerald-100" />
        <Link href="/" className="relative flex items-center gap-2 text-lg font-bold tracking-tight text-slate-800">
          <span className="grid size-9 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><GraduationCap size={21} /></span>
          schol<span className="text-emerald-700">ix</span>
        </Link>
        <div className="relative max-w-lg pb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Academic result management</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-800">A clearer view of every academic journey.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-500">Manage academic structures, assessments, marks, approvals, and published results in one connected workspace.</p>
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} className="text-emerald-700" /> Role-based access with database-level protection</div>
        </div>
        <p className="relative text-[11px] text-slate-400">Scholix · University Academic Result Processing System</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 flex items-center gap-2 text-lg font-bold tracking-tight text-slate-800 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-[#e4f5e9] text-emerald-700"><GraduationCap size={21} /></span>
            schol<span className="text-emerald-700">ix</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">Welcome back</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800">Sign in to your account</h2>
          <p className="mt-2 text-sm text-slate-500">Use the university account assigned to you.</p>
          {demoMode ? (
            <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Preview mode is enabled</p>
              <p className="mt-1 text-xs leading-5 text-emerald-700">The dashboard uses sample data. Configure Supabase and disable demo mode before using real student records.</p>
              <Link href="/admin/dashboard" className="mt-3 inline-flex rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-2 text-xs font-semibold text-white">Open dashboard preview</Link>
            </div>
          ) : (
            <div className="mt-7"><LoginForm /></div>
          )}
          <p className="mt-8 text-center text-[11px] text-slate-400">Access is provided by your university administrator.</p>
        </div>
      </section>
    </main>
  );
}
