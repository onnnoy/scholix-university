"use client";
import Link from "next/link";
import {ArrowRight,BookOpen,BookOpenCheck,CalendarDays,ChartNoAxesCombined,ClipboardCheck,ClipboardList,GraduationCap,LibraryBig,ShieldCheck,UsersRound,UserRoundCog} from "lucide-react";
import {AdminShell} from "@/components/admin/admin-shell";
import type { AccessContext } from "@/lib/auth/access";
const items=[
["Students","Create logins, manage identities and academic enrolments.","/admin/students",UsersRound],["Teachers","Create faculty logins and manage department access.","/admin/teachers",UserRoundCog],
["Departments","Manage departments and academic ownership.","/admin/departments",LibraryBig],["Programs","Configure degree programs and semester sequences.","/admin/programs",GraduationCap],
["Courses","Manage catalogs and credit hours.","/admin/courses",BookOpen],["Course offerings","Schedule courses and assign faculty.","/admin/course-offerings",BookOpenCheck],
["Assessments","Configure assignments, tests, midterms and finals.","/admin/assessments",ClipboardCheck],["Marks entry","Enter and validate assessment marks.","/admin/marks",ClipboardList],
["Results & approvals","Calculate, submit and approve course results.","/admin/results",ShieldCheck],["Academic sessions","Maintain student intake sessions.","/admin/sessions",CalendarDays],
["Semesters & terms","Define semesters and actual academic terms.","/admin/terms",CalendarDays],["Reports","Review roster and published result summaries.","/admin/reports",ChartNoAxesCombined],
] as const;
export function AdminHome({stats,error,roles}:{stats:Record<string,number>;error?:string;roles:AccessContext["roles"]}){
 return <AdminShell activeHref="/admin/dashboard" title="Overview" description="Your academic administration workspace. Manage students first, then courses, assessments, marks and published results." roles={roles}>
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{([["Students",stats.students??0],["Teachers",stats.teachers??0],["Programs",stats.programs??0],["Published results",stats.publishedResults??0]] as const).map(([label,value])=><section key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-4xl font-bold tracking-tight text-slate-950">{value}</p></section>)}</div>
  {error&&<div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Dashboard summary: {error}. Management modules remain available below.</div>}
  <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-bold">Academic management</h2><p className="mt-1 text-sm text-slate-500">Open a module to manage real records in the connected database.</p></div><Link href="/admin/students" className="hidden items-center gap-1 text-sm font-semibold text-emerald-700 sm:inline-flex">Manage students <ArrowRight size={15}/></Link></div>
   <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(([title,desc,href,Icon])=><Link key={href} href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={21}/></span><ArrowRight size={17} className="text-slate-300 group-hover:translate-x-1 group-hover:text-emerald-700"/></div><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{desc}</p></Link>)}</div>
  </section>
 </AdminShell>;
}