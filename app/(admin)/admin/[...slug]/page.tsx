import Link from "next/link";
import { ArrowLeft, Construction, GraduationCap } from "lucide-react";

const labels: Record<string, string> = {
  departments: "Departments",
  programs: "Academic programs",
  sessions: "Academic sessions",
  semesters: "Semester definitions",
  students: "Students",
  teachers: "Teachers",
  courses: "Courses",
  "course-offerings": "Course offerings",
  assessments: "Assessments",
  marks: "Marks entry",
  results: "Result processing",
  "result-approvals": "Result approvals",
  reports: "Reports",
  settings: "Settings",
};

export default async function AdminModulePlaceholder({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const route = slug.join("/");
  const title = labels[route] ?? route.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

  return (
    <main className="min-h-screen bg-[#f4f7f5] p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Back to dashboard</Link>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Construction size={20} /></span>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Module scaffold</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800">{title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">This route is reserved for the {title.toLowerCase()} workflow. The project foundation and dashboard are in place; this module will be implemented against the approved database schema and permissions rather than using placeholder CRUD behavior.</p>
          <div className="mt-7 flex flex-wrap items-center gap-2 text-xs text-slate-500"><GraduationCap size={15} className="text-emerald-600" /> Scholix academic management</div>
        </section>
      </div>
    </main>
  );
}
