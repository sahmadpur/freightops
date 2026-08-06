import { requireArea } from "@/lib/session";
import { getTheme } from "@/lib/theme-server";
import { Topbar } from "@/components/topbar";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireArea("portal");
  const theme = await getTheme();
  return (
    <div className="flex h-screen flex-col bg-surface">
      <Topbar userName={session.user.name} theme={theme} />
      <main className="flex-1 overflow-y-auto p-5">{children}</main>
    </div>
  );
}
