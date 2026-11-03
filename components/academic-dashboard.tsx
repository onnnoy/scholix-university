import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Settings2,
  ShieldCheck,
  Users,
  UsersRound,
  UserRoundCog,
  UserSquare2,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";

export type DashboardData = {
  stats: {
    students: string;
    programs: string;
    activeTerms: string;
    pendingApprovals: string;
    courses: string;
    teachers: string;
    marksToSubmit: string;
    publishedResults: string;
  };
  semesterBars: { semester: string; published: number; inReview: number; draft: number }[];
  processingTrend: { month: string; submitted: number; approved: number }[];
  gradeDistribution: { label: string; value: number; color: string }[];
  resultStatus: { label: string; value: number; color: string }[];
  recentActivity: {
    id: string;
    title: string;
    detail: string;
    date: string;
    status: "Published" | "Under review" | "Draft";
  }[];
};

/**
 * Demonstration data only. Replace this object with values fetched in a Server
 * Component from Supabase before using the dashboard with real university data.
 */
export const demoDashboardData: DashboardData = {
  stats: {
    students: "2,486",
    programs: "12",
    activeTerms: "8",
    pendingApprovals: "18",
    courses: "146",
    teachers: "84",
    marksToSubmit: "32",
    publishedResults: "24",
  },
  semesterBars: [
    { semester: "S1", published: 76, inReview: 14, draft: 10 },
    { semester: "S2", published: 69, inReview: 18, draft: 13 },
    { semester: "S3", published: 82, inReview: 10, draft: 8 },
    { semester: "S4", published: 62, inReview: 23, draft: 15 },
    { semester: "S5", published: 73, inReview: 17, draft: 10 },
    { semester: "S6", published: 88, inReview: 8, draft: 4 },
    { semester: "S7", published: 58, inReview: 24, draft: 18 },
    { semester: "S8", published: 80, inReview: 12, draft: 8 },
  ],
  processingTrend: [
    { month: "Jan", submitted: 24, approved: 14 },
    { month: "Feb", submitted: 31, approved: 23 },
    { month: "Mar", submitted: 29, approved: 19 },
    { month: "Apr", submitted: 44, approved: 34 },
    { month: "May", submitted: 40, approved: 32 },
    { month: "Jun", submitted: 57, approved: 45 },
    { month: "Jul", submitted: 49, approved: 40 },
    { month: "Aug", submitted: 65, approved: 53 },
    { month: "Sep", submitted: 59, approved: 47 },
    { month: "Oct", submitted: 72, approved: 62 },
    { month: "Nov", submitted: 81, approved: 69 },
    { month: "Dec", submitted: 76, approved: 71 },
  ],
  gradeDistribution: [
    { label: "A / A+", value: 28, color: "#63c98b" },
    { label: "B range", value: 37, color: "#8c8cf3" },
    { label: "C range", value: 23, color: "#51c8d8" },
    { label: "Below C", value: 12, color: "#f4a18d" },
  ],
  resultStatus: [
    { label: "Published", value: 64, color: "#63c98b" },
    { label: "Under review", value: 24, color: "#66cbd5" },
    { label: "Draft", value: 12, color: "#f3b77c" },
  ],
  recentActivity: [
    { id: "CSE-321", title: "Data Structures", detail: "CSE · 3rd Semester · 42 students", date: "Today, 10:42 AM", status: "Under review" },
    { id: "CSE-415", title: "Database Management Systems", detail: "CSE · 4th Semester · 38 students", date: "Today, 9:18 AM", status: "Published" },
    { id: "EEE-203", title: "Electrical Circuits", detail: "EEE · 2nd Semester · 51 students", date: "Yesterday", status: "Draft" },
    { id: "BBA-306", title: "Business Finance", detail: "BBA · 3rd Semester · 46 students", date: "Nov 1, 2026", status: "Published" },
  ],
};

export const emptyDashboardData: DashboardData = {
  stats: { students: "0", programs: "0", activeTerms: "0", pendingApprovals: "0", courses: "0", teachers: "0", marksToSubmit: "0", publishedResults: "0" },
  semesterBars: [],
  processingTrend: [],
  gradeDistribution: [],
  resultStatus: [],
  recentActivity: [],
};

const primaryNavigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Departments", href: "/admin/departments", icon: LibraryBig },
  { label: "Programs", href: "/admin/programs", icon: GraduationCap },
  { label: "Academic Sessions", href: "/admin/sessions", icon: CalendarDays },
  { label: "Semesters", href: "/admin/semesters", icon: BookOpen },
];

const peopleNavigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Students", href: "/admin/students", icon: UsersRound },
  { label: "Teachers", href: "/admin/teachers", icon: UserRoundCog },
];

const academicNavigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Courses", href: "/admin/courses", icon: BookOpenCheck },
  { label: "Course Offerings", href: "/admin/course-offerings", icon: ClipboardList },
  { label: "Assessments", href: "/admin/assessments", icon: ClipboardCheck },
  { label: "Marks Entry", href: "/admin/marks", icon: UserSquare2 },
  { label: "Result Processing", href: "/admin/results", icon: ChartNoAxesCombined },
  { label: "Result Approvals", href: "/admin/result-approvals", icon: ShieldCheck },
  { label: "Reports", href: "/admin/reports", icon: Activity },
];

function SidebarGroup({
  title,
  items,
  active = false,
}: {
  title?: string;
  items: { label: string; href: string; icon: LucideIcon }[];
  active?: boolean;
}) {
  return (
    <div className="space-y-1">
      {title ? (
        <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {title}
        </p>
      ) : null}
      {items.map(({ label, href, icon: Icon }) => {
        const selected = active && label === "Dashboard";
        return (
          <a
            key={label}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={`group flex min-h-9 items-center gap-3 rounded-lg px-3 text-[12px] font-medium transition-colors ${
              selected
                ? "bg-gradient-to-r from-[#d8f4df] to-[#bce9ca] text-slate-800 shadow-[inset_0_0_0_1px_rgba(65,170,103,0.12)]"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon size={16} strokeWidth={1.8} className={selected ? "text-[#278d50]" : "text-slate-500 group-hover:text-slate-700"} />
            <span>{label}</span>
          </a>
        );
      })}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[226px] flex-col border-r border-slate-200/80 bg-white px-3 pb-4 pt-4 lg:flex">
      <a href="/admin/dashboard" className="mb-5 flex items-center gap-2 px-2">
        <span className="grid size-8 place-items-center rounded-xl bg-[#e7f8eb] text-[#278d50]">
          <GraduationCap size={19} strokeWidth={2.1} />
        </span>
        <span className="text-[17px] font-bold tracking-tight text-slate-800">schol<span className="text-[#55b879]">ix</span></span>
        <span className="ml-auto grid size-7 place-items-center rounded-md border border-slate-200 text-slate-500">
          <LayoutDashboard size={14} />
        </span>
      </a>

      <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        <SidebarGroup items={primaryNavigation} active />
        <SidebarGroup title="People" items={peopleNavigation} />
        <SidebarGroup title="Academic management" items={academicNavigation} />
      </nav>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <a href="/admin/settings" className="flex min-h-9 items-center gap-3 rounded-lg px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-100">
          <Settings2 size={16} className="text-slate-500" /> Settings
        </a>
        <div className="mt-2 flex items-center gap-2 rounded-lg px-2 py-2">
          <div className="grid size-8 place-items-center rounded-full bg-[#e9f5ed] text-[11px] font-bold text-[#287b49]">SA</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-slate-800">Administrator</p>
            <p className="text-[10px] text-slate-500">Super admin</p>
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>
    </aside>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
  trend,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: "green" | "blue" | "violet" | "orange";
  trend?: string;
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    blue: "bg-sky-50 text-sky-600 ring-sky-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
  };
  return (
    <section className="relative min-w-0 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
      <div className="flex items-start justify-between gap-2">
        <div className={`grid size-8 shrink-0 place-items-center rounded-lg ring-1 ${tones[tone]}`}>
          <Icon size={16} strokeWidth={1.8} />
        </div>
        {trend ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
            <ArrowUpRight size={12} /> {trend}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] font-medium text-slate-500">{label}</p>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <p className="text-[23px] font-semibold leading-none tracking-tight text-slate-800">{value}</p>
        <p className="text-right text-[10px] text-slate-400">{note}</p>
      </div>
    </section>
  );
}

function MiniMetric({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: "green" | "blue" | "violet" | "orange" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
      <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon size={16} /></div>
      <div className="min-w-0">
        <p className="truncate text-[10px] text-slate-500">{label}</p>
        <p className="text-[16px] font-semibold leading-tight text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function PanelHeading({ title, subtitle, action = "" }: { title: string; subtitle?: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-500"><ChartNoAxesCombined size={14} /></span>
        <div className="min-w-0">
          <h2 className="truncate text-[12px] font-semibold text-slate-800">{title}</h2>
          {subtitle ? <p className="text-[10px] text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <button type="button" className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-50">{action}</button> : null}
    </div>
  );
}

function SemesterBarChart({ data }: { data: DashboardData["semesterBars"] }) {
  if (data.length === 0) return <div className="grid h-[215px] place-items-center text-xs text-slate-400">No semester result data available yet.</div>;
  return (
    <div className="pt-1">
      <div className="relative h-[190px] pl-7">
        <div className="absolute inset-y-0 left-0 flex flex-col justify-between pb-6 text-[9px] text-slate-400"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
        <div className="absolute inset-0 left-7 bottom-6 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map((line) => <div key={line} className="border-t border-dashed border-slate-100" />)}
        </div>
        <div className="absolute inset-x-2 bottom-0 top-0 flex items-end justify-around gap-2 pl-5 pr-1">
          {data.map((item) => (
            <div key={item.semester} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-[164px] w-full max-w-[28px] items-end gap-[2px]">
                <div title={`Published ${item.published}%`} className="w-1/3 rounded-t-[3px] bg-[#72c991]" style={{ height: `${item.published}%` }} />
                <div title={`In review ${item.inReview}%`} className="w-1/3 rounded-t-[3px] bg-[#8bd7dc]" style={{ height: `${item.inReview}%` }} />
                <div title={`Draft ${item.draft}%`} className="w-1/3 rounded-t-[3px] bg-[#f5b49f]" style={{ height: `${item.draft}%` }} />
              </div>
              <span className="text-[9px] text-slate-500">{item.semester}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[9px] text-slate-500">
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-[#72c991]" /> Published</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-[#8bd7dc]" /> In review</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-[#f5b49f]" /> Draft</span>
      </div>
    </div>
  );
}

function TrendLineChart({ data }: { data: DashboardData["processingTrend"] }) {
  if (data.length === 0) return <div className="grid h-[215px] place-items-center text-xs text-slate-400">Result processing history will appear here.</div>;
  const makePoints = (key: "submitted" | "approved") => data.map((point, index) => {
    const x = 12 + index * (576 / Math.max(1, data.length - 1));
    const y = 178 - point[key] * 1.7;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="pt-1">
      <svg viewBox="0 0 600 205" role="img" aria-label="Monthly result submission and approval trend" className="h-[190px] w-full overflow-visible">
        {[0, 1, 2, 3, 4].map((line) => <g key={line}><line x1="12" x2="588" y1={8 + line * 42} y2={8 + line * 42} stroke="#edf1f2" strokeDasharray="3 4" /><text x="0" y={12 + line * 42} fontSize="9" fill="#94a3b8">{100 - line * 25}</text></g>)}
        {data.map((point, index) => <line key={point.month} x1={12 + index * (576 / Math.max(1, data.length - 1))} x2={12 + index * (576 / Math.max(1, data.length - 1))} y1="8" y2="178" stroke="#f5f7f8" />)}
        <polyline points={makePoints("submitted")} fill="none" stroke="#69c78a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={makePoints("approved")} fill="none" stroke="#f39d8b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((point, index) => {
          const x = 12 + index * (576 / Math.max(1, data.length - 1));
          return <g key={point.month}><text x={x} y="197" textAnchor="middle" fontSize="9" fill="#64748b">{point.month}</text></g>;
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-[9px] text-slate-500">
        <span className="flex items-center gap-1.5"><i className="h-[2px] w-3 rounded bg-[#69c78a]" /> Marks submitted</span>
        <span className="flex items-center gap-1.5"><i className="h-[2px] w-3 rounded bg-[#f39d8b]" /> Results approved</span>
      </div>
    </div>
  );
}

function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="size-[112px] shrink-0" role="img" aria-label="Distribution chart">
      <circle cx="60" cy="60" r="43" fill="none" stroke="#f1f5f5" strokeWidth="13" />
      {data.map((item) => {
        const currentOffset = offset;
        offset += item.value;
        return <circle key={item.label} cx="60" cy="60" r="43" fill="none" stroke={item.color} strokeWidth="13" pathLength="100" strokeDasharray={`${item.value} ${100 - item.value}`} strokeDashoffset={-currentOffset} transform="rotate(-90 60 60)" />;
      })}
      <text x="60" y="57" textAnchor="middle" fontSize="17" fontWeight="700" fill="#263449">100%</text>
      <text x="60" y="71" textAnchor="middle" fontSize="8" fill="#94a3b8">overview</text>
    </svg>
  );
}

function DonutPanel({ title, subtitle, data }: { title: string; subtitle: string; data: DashboardData["gradeDistribution"] }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-[12px] font-semibold text-slate-800">{title}</h2><span className="text-[9px] text-slate-400">{subtitle}</span></div>
      {data.length === 0 ? (
        <div className="grid h-[116px] place-items-center text-[10px] text-slate-400">No published grades yet.</div>
      ) : <div className="flex items-center justify-center gap-2">
        <Donut data={data} />
        <div className="min-w-0 space-y-2">
          {data.map((item) => <div key={item.label} className="flex items-center gap-1.5 text-[9px] text-slate-500"><i className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1">{item.label}</span><b className="font-semibold text-slate-700">{item.value}%</b></div>)}
        </div>
      </div>}
    </section>
  );
}

function ProgressPanel({ title, subtitle, data }: { title: string; subtitle: string; data: DashboardData["resultStatus"] }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-[12px] font-semibold text-slate-800">{title}</h2><span className="text-[9px] text-slate-400">{subtitle}</span></div>
      {data.length === 0 ? <p className="py-5 text-center text-[10px] text-slate-400">No workflow activity yet.</p> : <div className="space-y-3.5">
        {data.map((item) => <div key={item.label}>
          <div className="mb-1 flex justify-between gap-2 text-[9px]"><span className="text-slate-600">{item.label}</span><b className="font-semibold text-slate-700">{item.value}%</b></div>
          <div className="h-[7px] overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} /></div>
        </div>)}
      </div>}
    </section>
  );
}

function StatusPill({ status }: { status: DashboardData["recentActivity"][number]["status"] }) {
  const styles = {
    Published: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    "Under review": "bg-sky-50 text-sky-700 ring-sky-100",
    Draft: "bg-orange-50 text-orange-700 ring-orange-100",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-medium ring-1 ring-inset ${styles[status]}`}>{status}</span>;
}

export function AcademicDashboard({ data, isDemo = false }: { data: DashboardData; isDemo?: boolean }) {
  const { stats } = data;
  return (
    <div className="min-h-screen bg-[#f5f7f6] text-slate-800">
      <Sidebar />
      <main className="min-h-screen lg:pl-[226px]">
        <div className="mx-auto max-w-[1600px] p-3 sm:p-5 xl:p-6">
          <nav aria-label="Mobile navigation" className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1.5 lg:hidden">
            {[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Students", href: "/admin/students" }, { label: "Courses", href: "/admin/courses" }, { label: "Marks", href: "/admin/marks" }, { label: "Results", href: "/admin/results" }, { label: "Reports", href: "/admin/reports" }].map((item, index) => (
              <a key={item.href} href={item.href} className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-medium ${index === 0 ? "bg-[#e5f5e9] text-[#267546]" : "text-slate-500 hover:bg-slate-50"}`}>{item.label}</a>
            ))}
          </nav>
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-slate-400">Academic administration</p>
              <h1 className="mt-1 text-[20px] sm:text-[21px] font-semibold tracking-tight text-slate-800">Dashboard overview</h1>
            </div>
            <div className="flex items-center gap-2">
              {isDemo ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700">Demo data</span> : null}
              <span className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-600 shadow-sm sm:flex"><CalendarDays size={14} /> Academic administration</span>
              <div className="grid size-9 place-items-center rounded-full border border-[#d9ecdf] bg-[#e8f6ec] text-[11px] font-bold text-[#287b49]">AD</div>
              {!isDemo ? <form action={signOutAction}><button type="submit" aria-label="Sign out" title="Sign out" className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"><LogOut size={15} /></button></form> : null}
            </div>
          </header>

          <section aria-label="Academic summary" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label="Total Students" value={stats.students} note="Across all sessions" icon={UsersRound} tone="orange" />
            <MetricCard label="Academic Programs" value={stats.programs} note="Across departments" icon={LibraryBig} tone="blue" />
            <MetricCard label="Active Academic Terms" value={stats.activeTerms} note="Currently running" icon={CalendarDays} tone="violet" />
            <MetricCard label="Pending Result Approvals" value={stats.pendingApprovals} note="Requires attention" icon={ShieldCheck} tone="green" />
          </section>

          <section aria-label="Additional academic metrics" className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMetric label="Courses" value={stats.courses} icon={BookOpen} tone="violet" />
            <MiniMetric label="Active Teachers" value={stats.teachers} icon={Users} tone="green" />
            <MiniMetric label="Marks Awaiting Submission" value={stats.marksToSubmit} icon={ClipboardList} tone="orange" />
            <MiniMetric label="Published Semester Results" value={stats.publishedResults} icon={CheckCircle2} tone="blue" />
          </section>

          <section className="mt-2.5 grid grid-cols-1 gap-2.5 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
              <PanelHeading title="Semester result status" subtitle="Published, review, and draft results by semester" action="This year" />
              <SemesterBarChart data={data.semesterBars} />
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
              <PanelHeading title="Result processing trend" subtitle="Monthly marks submission and result approval" action="12 months" />
              <TrendLineChart data={data.processingTrend} />
            </div>
          </section>

          <section className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-4">
            <DonutPanel title="Grade distribution" subtitle="All published results" data={data.gradeDistribution} />
            <DonutPanel title="Result composition" subtitle="Current academic year" data={data.resultStatus} />
            <ProgressPanel title="Result workflow" subtitle="Semester results" data={data.resultStatus} />
            <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-[12px] font-semibold text-slate-800">Academic health</h2><span className="text-[9px] text-slate-400">At a glance</span></div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="grid size-6 place-items-center rounded-md bg-emerald-50 text-emerald-600"><CheckCircle2 size={13} /></span>Published results</div><b className="text-[12px] text-slate-800">{stats.publishedResults}</b></div>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="grid size-6 place-items-center rounded-md bg-sky-50 text-sky-600"><ClipboardCheck size={13} /></span>Awaiting approval</div><b className="text-[12px] text-slate-800">{stats.pendingApprovals}</b></div>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="grid size-6 place-items-center rounded-md bg-orange-50 text-orange-600"><ArrowDownRight size={13} /></span>Marks to submit</div><b className="text-[12px] text-slate-800">{stats.marksToSubmit}</b></div>
              </div>
              <div className="mt-4 rounded-lg bg-[#f0f8f2] p-2.5 text-[9px] leading-relaxed text-[#4a7958]">Keep course marks complete and approved before publishing semester results.</div>
            </section>
          </section>

          <section className="mt-2.5 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div><h2 className="text-[12px] font-semibold text-slate-800">Recent result activity</h2><p className="mt-0.5 text-[10px] text-slate-400">Latest course result submissions and publication events</p></div>
              <a href="/admin/result-approvals" className="text-[10px] font-semibold text-[#388f59] hover:text-[#267546]">View all activity <span aria-hidden="true">→</span></a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead><tr className="bg-[#fafcfb] text-[9px] uppercase tracking-[0.08em] text-slate-400"><th className="px-4 py-2.5 font-semibold">Course</th><th className="px-4 py-2.5 font-semibold">Course offering</th><th className="px-4 py-2.5 font-semibold">Updated</th><th className="px-4 py-2.5 font-semibold">Status</th></tr></thead>
                <tbody>{data.recentActivity.length === 0 ? <tr><td colSpan={4} className="px-4 py-9 text-center text-[11px] text-slate-400">No result activity to display yet.</td></tr> : data.recentActivity.map((item) => <tr key={item.id} className="border-t border-slate-100 text-[10px] hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-semibold text-slate-700">{item.title}</p><p className="mt-0.5 text-[9px] text-slate-400">{item.id}</p></td><td className="px-4 py-3 text-slate-500">{item.detail}</td><td className="px-4 py-3 text-slate-500">{item.date}</td><td className="px-4 py-3"><StatusPill status={item.status} /></td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <p className="mt-4 text-center text-[9px] text-slate-400">Academic result management · Academic administration dashboard</p>
        </div>
      </main>
    </div>
  );
}
