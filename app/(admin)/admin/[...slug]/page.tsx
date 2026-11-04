import {notFound} from "next/navigation";
import {AdminWorkspace} from "@/components/admin/admin-workspace";
export const metadata={title:"Academic management"};
const routes:Record<string,string>={departments:"departments",programs:"programs",sessions:"sessions",semesters:"semesters",terms:"terms",students:"students",teachers:"teachers",courses:"courses","course-offerings":"offerings",assessments:"assessments",marks:"marks",results:"results","result-approvals":"results",reports:"reports",settings:"settings"};
export default async function AdminModulePage({params}:{params:Promise<{slug:string[]}>}){const {slug}=await params;const resource=routes[slug.join("/")];if(!resource)notFound();return <AdminWorkspace resource={resource}/>;}
