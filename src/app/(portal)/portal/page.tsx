import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireArea } from "@/lib/session";
import { listClientOrders } from "@/modules/orders/queries";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { session } = await requireArea("portal");
  const t = await getTranslations();
  const sp = await searchParams;
  const accountId = session.user.accountId;
  const orders = accountId ? await listClientOrders(accountId, { q: sp.q, status: sp.status }) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("nav.myOrders")}</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">{t("portal.noOrders")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">{t("fields.orderId")}</th>
                <th className="px-4 py-2">{t("fields.orderTitle")}</th>
                <th className="px-4 py-2">{t("fields.route")}</th>
                <th className="px-4 py-2">{t("fields.status")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/portal/orders/${o.id}`} className="font-medium text-indigo-600 hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{o.title}</td>
                  <td className="px-4 py-2 text-slate-500">{o.route ?? "—"}</td>
                  <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
