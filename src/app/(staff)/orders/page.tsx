import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { StatusBadge } from "@/components/ui/status-badge";
import { listOrders } from "@/modules/orders/queries";
import { orderStatusEnum } from "@/db/schema";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = sp.status || undefined;
  const page = Number(sp.page) || 1;
  const t = await getTranslations();
  const format = await getFormatter();
  const { rows, total } = await listOrders({ q, status, page });

  const pill = (label: string, value: string | undefined, active: boolean) => {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (q) params.set("q", q);
    const href = params.toString() ? `/orders?${params}` : "/orders";
    return (
      <Link
        key={label}
        href={href}
        className={`rounded-full border px-3 py-1 text-xs ${active ? "border-[#1a3a5c] bg-[#1a3a5c] text-white" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title={t("nav.orders")}
        action={
          <Link href="/orders/new" className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white">
            + {t("orders.newOrder")}
          </Link>
        }
      />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {pill(t("orders.allOrders"), undefined, !status)}
        {orderStatusEnum.enumValues.map((s) => pill(t(`status.${s}`), s, status === s))}
      </div>
      <form className="mb-3" action="/orders">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q}
          placeholder={t("orders.searchPlaceholder")}
          className="w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3a5c]"
        />
      </form>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11.5px] text-slate-500">
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.createdAt")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.orderId")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.client")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.orderTitle")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.route")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.transport")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.clientCharge")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.status")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.lastModified")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.actionsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-3.5 py-8 text-center text-slate-400">{t("orders.empty")}</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-500">{format.dateTime(r.createdAt, { dateStyle: "medium" })}</td>
                  <td className="px-3.5 py-2.5 font-medium text-[#1a3a5c]">{r.number}</td>
                  <td className="px-3.5 py-2.5">{r.accountTitle}</td>
                  <td className="px-3.5 py-2.5">{r.title}</td>
                  <td className="px-3.5 py-2.5">{r.route ?? "—"}</td>
                  <td className="px-3.5 py-2.5">{r.transportNumber ?? "—"}</td>
                  <td className="px-3.5 py-2.5">{r.clientCharge ? `$${Number(r.clientCharge).toLocaleString("en-US")}` : "—"}</td>
                  <td className="px-3.5 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-500">{format.dateTime(r.updatedAt, { dateStyle: "medium" })}</td>
                  <td className="px-3.5 py-2.5">
                    <span className="flex gap-2 text-xs">
                      <Link className="text-[#1a3a5c] hover:underline" href={`/orders/${r.id}`}>{t("actions.view")}</Link>
                      <Link className="text-[#1a3a5c] hover:underline" href={`/orders/${r.id}/edit`}>{t("actions.edit")}</Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Paginator page={page} total={total} basePath="/orders" params={{ ...(q ? { q } : {}), ...(status ? { status } : {}) }} />
    </div>
  );
}
