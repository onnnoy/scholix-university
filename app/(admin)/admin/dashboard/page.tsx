import {redirect} from "next/navigation";
import {AdminHome} from "@/components/admin/admin-home";
import {createClient} from "@/lib/supabase/server";
import {getAccessContext} from "@/lib/auth/access";
import {dashboardSummarySchema} from "@/features/dashboard/schema";
export const metadata={title:"Dashboard"};
export default async function AdminDashboardPage(){
 const context=await getAccessContext();
 if(context.roles.some((r)=>r.role==="department_admin"))redirect("/admin/students");
 if(context.roles.some((r)=>r.role==="exam_controller"))redirect("/admin/results");
 if(!context.roles.some((r)=>r.role==="super_admin")&&!context.demo)redirect("/login?error=not_authorized");
 const supabase=await createClient();const {data,error}=await supabase.rpc("get_dashboard_summary");const parsed=dashboardSummarySchema.safeParse(data);
 const stats=parsed.success?{students:parsed.data.students,teachers:parsed.data.teachers,programs:parsed.data.programs,publishedResults:parsed.data.publishedResults}:{students:0,teachers:0,programs:0,publishedResults:0};
 return <AdminHome stats={stats} error={error?.message??(!parsed.success?"Dashboard summary is invalid.":undefined)}/>;
}