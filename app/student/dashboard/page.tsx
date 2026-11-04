import {requirePortalRole} from "@/lib/auth/access";
import {StudentResults} from "@/components/student/student-results";
export const metadata={title:"My results"};
export default async function StudentDashboardPage(){await requirePortalRole("student");return <StudentResults/>;}
