import { getTranslations } from "next-intl/server";
import { requireArea } from "@/lib/session";
import { listClientOrders } from "@/modules/orders/queries";
import { ClientOrdersTable } from "@/modules/orders/client-orders-table";

export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { session } = await requireArea("portal");
  const t = await getTranslations();
  const sp = await searchParams;
  const accountId = session.user.accountId;
  const orders = accountId ? await listClientOrders(accountId, { q: sp.q, status: sp.status }) : [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[26px] font-medium leading-[1.05] tracking-[-0.01em] text-brand-deep">
        {t("nav.myOrders")}
      </h1>
      <ClientOrdersTable rows={orders} />
    </div>
  );
}
