import {redirect, notFound} from "next/navigation";
import {AdminWorkspace} from "@/components/admin/admin-workspace";
import {requireAdminAccess} from "@/lib/auth/access";
export const metadata={title:"Academic management"};
const routes:Record<string,string>={departments:"departments",programs:"programs",sessions:"sessions",semesters:"semesters",terms:"terms",students:"students",teachers:"teachers",courses:"courses","course-offerings":"offerings",assessments:"assessments",marks:"marks",results:"results","result-approvals":"results",reports:"reports",settings:"settings"};
const departmentAdminResources=new Set(["programs","semesters","terms","students","teachers","courses","offerings","assessments","marks","results","reports"]);
const examinationControllerResources=new Set(["students","teachers","courses","offerings","assessments","marks","results","reports"]);
export default async function AdminModulePage({params}:{params:Promise<{slug:string[]}>}){
 const context=await requireAdminAccess();
 const {slug}=await params;
 const key=slug.join("/");
 const resource=routes[key];
 if(!resource)notFound();
 const roleNames=context.roles.map((item)=>item.role);
 const isSuper=roleNames.includes("super_admin");
 const isDepartmentAdmin=roleNames.includes("department_admin");
 const isExamController=roleNames.includes("exam_controller");
 const allowed=isSuper||(isDepartmentAdmin&&departmentAdminResources.has(resource))||(isExamController&&examinationControllerResources.has(resource));
 if(!allowed)redirect(isExamController?"/admin/results":"/admin/students");
 return <AdminWorkspace resource={resource} roles={context.roles}/>;
}