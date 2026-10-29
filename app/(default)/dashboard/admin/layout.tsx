import { requireAdminPage } from "@/lib/auth/adminAccess";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdminPage();
  return children;
}
