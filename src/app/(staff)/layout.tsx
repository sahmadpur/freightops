import { requireArea } from "@/lib/session";
import { MobileNav, Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { session, role } = await requireArea("staff");
  return (
    <div className="flex h-screen bg-surface">
      <Sidebar isAdmin={role === "admin"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={session.user.name} />
        <MobileNav isAdmin={role === "admin"} />
        <main className="flex-1 overflow-y-auto p-4 md:p-5">{children}</main>
      </div>
    </div>
  );
}
