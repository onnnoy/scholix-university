import { requirePortalRole } from "@/lib/auth/access";
import { BookOpen, GraduationCap } from "lucide-react";

export const metadata = { title: "Student portal" };

export default async function StudentDashboardPage() {
  await requirePortalRole("student");
  return (
    <main className="min-h-screen bg-[#f4f7f5] p-6 sm:p-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><GraduationCap size={21} /></span>
        <h1 className="mt-5 text-2xl font-semibold text-slate-800">Student portal</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your published semester results, SGPA, CGPA, and transcript will appear here after the result module is implemented.</p>
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400"><BookOpen size={15} /> Only published results for your own student account will be shown.</div>
      </div>
    </main>
  );
}
