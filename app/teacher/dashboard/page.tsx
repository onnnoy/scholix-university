import {requirePortalRole} from "@/lib/auth/access";
import {TeacherWorkspace} from "@/components/teacher/teacher-workspace";
export const metadata={title:"My teaching"};
export default async function TeacherDashboardPage(){await requirePortalRole("teacher");return <TeacherWorkspace/>;}
