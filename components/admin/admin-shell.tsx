"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {BookOpen,BookOpenCheck,CalendarDays,ChartNoAxesCombined,ClipboardCheck,ClipboardList,GraduationCap,LayoutDashboard,LibraryBig,Menu,Settings2,ShieldCheck,Users,UsersRound,UserRoundCog,X} from "lucide-react";
import {SignOutButton} from "@/components/auth/sign-out-button";
import type {AccessContext} from "@/lib/auth/access";
const nav=[
["Overview","/admin/dashboard",LayoutDashboard],["Departments","/admin/departments",LibraryBig],["Programs","/admin/programs",GraduationCap],
["Academic sessions","/admin/sessions",CalendarDays],["Semesters","/admin/semesters",BookOpen],["Academic terms","/admin/terms",CalendarDays],
["Students","/admin/students",UsersRound],["Teachers","/admin/teachers",UserRoundCog],["Courses","/admin/courses",BookOpenCheck],
["Course offerings","/admin/course-offerings",ClipboardList],["Assessments","/admin/assessments",ClipboardCheck],["Marks entry","/admin/marks",Users],
["Results & approvals","/admin/results",ShieldCheck],["Reports","/admin/reports",ChartNoAxesCombined],["Settings","/admin/settings",Settings2],
] as const;
export function AdminShell({activeHref,title,description,children,roles}:{activeHref:string;title:string;description:string;children:React.ReactNode;roles:AccessContext["roles"]}){
 const roleNames=roles.map((item)=>item.role);
 const isSuper=roleNames.includes("super_admin");
 const isDepartmentAdmin=roleNames.includes("department_admin");
 const isExamController=roleNames.includes("exam_controller");
 const allowedHrefs=isSuper?null:isDepartmentAdmin
  ?new Set(["/admin/programs","/admin/semesters","/admin/terms","/admin/students","/admin/teachers","/admin/courses","/admin/course-offerings","/admin/assessments","/admin/marks","/admin/results","/admin/reports"])
  :isExamController?new Set(["/admin/students","/admin/teachers","/admin/courses","/admin/course-offerings","/admin/assessments","/admin/marks","/admin/results","/admin/reports"]):new Set<string>();
 const visibleNav=allowedHrefs?nav.filter(([,href])=>allowedHrefs.has(href)):nav;
 const roleLabel=isSuper?"Super Administrator":isDepartmentAdmin?"Department Administrator":isExamController?"Examination Controller":"Administrator";
 const [mobile,setMobile]=useState(false);
 const mobileNavRef=useRef<HTMLElement>(null);
 const menuButtonRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!mobile)return;
  const drawer=mobileNavRef.current;
  const getFocusable=()=>Array.from(drawer?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')??[]);
  document.body.style.overflow="hidden";
  getFocusable()[0]?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();setMobile(false);return;}
   if(event.key!=="Tab")return;
   const items=getFocusable();
   if(!items.length){event.preventDefault();drawer?.focus();return;}
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  window.addEventListener("keydown",onKeyDown);
  return ()=>{
   window.removeEventListener("keydown",onKeyDown);
   document.body.style.overflow="";
   menuButtonRef.current?.focus();
  };
 },[mobile]);
 const links=(small=false)=><nav aria-label="Main navigation" className="space-y-1">{visibleNav.map(([label,href,Icon])=>{const active=activeHref===href||(href!=="/admin/dashboard"&&activeHref.startsWith(href));return <Link key={href} href={href} onClick={()=>small&&setMobile(false)} aria-current={active?"page":undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${active?"bg-emerald-50 text-emerald-800":"text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={18}/>{label}</Link>})}</nav>;
 return <div className="min-h-screen bg-[#f5f7f6] text-slate-800">
  <aside aria-label="Admin sidebar" className="fixed inset-y-0 left-0 z-30 hidden w-[254px] flex-col border-r border-slate-200 bg-white lg:flex">
   <Link href="/admin/dashboard" className="flex h-[78px] items-center gap-3 border-b border-slate-100 px-6"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><GraduationCap size={24}/></span><span className="text-[22px] font-bold">schol<span className="text-emerald-600">ix</span><span className="mt-0.5 block text-[10px] uppercase tracking-[.16em] text-slate-400">Academic management</span></span></Link>
   <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5"><p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[.14em] text-slate-400">Workspace</p>{links()}</div>
   <div className="border-t border-slate-100 p-4"><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">SA</span><span><b className="block text-sm">Academic staff</b><span className="text-xs text-slate-500">{roleLabel}</span></span></div></div>
  </aside>
  {mobile&&<div className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden">
   <aside id="admin-mobile-navigation" ref={mobileNavRef} role="dialog" aria-modal="true" aria-labelledby="admin-mobile-navigation-title" tabIndex={-1} className="h-full w-[min(310px,86vw)] overflow-y-auto bg-white p-4 shadow-xl">
    <div className="mb-5 flex items-center justify-between"><h2 id="admin-mobile-navigation-title" className="text-xl font-bold">Main navigation</h2><button type="button" onClick={()=>setMobile(false)} aria-label="Close navigation" className="rounded-lg p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><X aria-hidden="true"/></button></div>
    {links(true)}
   </aside>
  </div>}
  <div className="min-h-screen lg:pl-[254px]">
   <header className="sticky top-0 z-20 flex min-h-[78px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7"><div className="flex min-w-0 items-center gap-3"><button ref={menuButtonRef} type="button" onClick={()=>setMobile(true)} aria-label="Open navigation" aria-expanded={mobile} aria-controls="admin-mobile-navigation" className="rounded-lg p-2 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 lg:hidden"><Menu size={21}/></button><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-emerald-700">{roleLabel}</p><p className="truncate text-sm text-slate-600">{title}</p></div></div><div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 sm:inline-flex">Live database</span><SignOutButton/></div></header>
   <main className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9"><div className="mb-7"><h1 className="text-[28px] font-bold tracking-tight text-slate-950 sm:text-[34px]">{title}</h1><p className="mt-2 max-w-3xl text-[15px] leading-6 text-slate-500">{description}</p></div>{children}</main>
  </div>
 </div>;
}