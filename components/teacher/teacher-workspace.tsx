"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {AlertCircle,BookOpen,GraduationCap,LoaderCircle} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
export function TeacherWorkspace(){
 const supabase=useMemo(()=>createClient(),[]);const [data,setData]=useState<any>({teacher:null,offerings:[]}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");const r=await supabase.functions.invoke("scholix-admin-data",{body:{action:"teacherWorkspace"}});if(r.error)setError(r.error.message);else setData(r.data?.data??{teacher:null,offerings:[]});setLoading(false);},[supabase]);
 useEffect(()=>{void load();},[load]);
 return <main className="min-h-screen bg-[#f5f7f6] px-4 py-8 sm:px-8"><div className="mx-auto max-w-6xl">
  <header className="mb-8 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><GraduationCap size={26}/></span><div><p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-700">Scholix faculty portal</p><h1 className="text-3xl font-bold tracking-tight">My teaching</h1></div></header>
  {error&&<div className="mb-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={18}/>{error}</div>}
  {loading?<div className="grid min-h-52 place-items-center"><LoaderCircle size={26} className="animate-spin"/></div>:!data.teacher?<section className="rounded-2xl border border-slate-200 bg-white p-8"><h2 className="text-lg font-bold">Teacher record not linked</h2><p className="mt-2 text-sm text-slate-600">Ask administration to link your teacher account.</p></section>:<>
   <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">Welcome</p><h2 className="mt-1 text-2xl font-bold">{data.teacher.full_name}</h2><p className="mt-1 text-sm text-slate-600">{data.teacher.teacher_number}</p></section>
   <section><h2 className="mb-3 text-xl font-bold">Assigned courses</h2>{data.offerings.length===0?<div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">No courses assigned yet.</div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.offerings.map((r:any,i:number)=><article key={r.id??r.course_id??i} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-emerald-700"><BookOpen size={18}/><span className="text-xs font-bold uppercase">Assigned course</span></div><h3 className="mt-3 text-lg font-bold">{r.course_code}</h3><p className="text-sm text-slate-600">{r.course_title??r.title}</p><p className="mt-3 text-xs text-slate-500">Session: {r.session_name??r.term_name??"Assigned term"}</p></article>)}</div>}</section>
  </>}
 </div></main>;
}