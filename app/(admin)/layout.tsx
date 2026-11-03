import { requireAdminAccess } from "@/lib/auth/access";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdminAccess();
  return children;
}
