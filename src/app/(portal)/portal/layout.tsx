import { requireArea } from "@/lib/session";
import { Topbar } from "@/components/topbar";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireArea("portal");
  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <Topbar userName={session.user.name} />
      <main className="flex-1 overflow-y-auto p-5">{children}</main>
    </div>
  );
}
