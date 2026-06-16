import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { OrdersTable } from "@/modules/orders/orders-table";
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
        className={`rounded-full border px-3 py-1 text-xs ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
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
          <Link href="/orders/new" className="btn-primary">
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
          className="w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600"
        />
      </form>
      <OrdersTable rows={rows} />
      <Paginator page={page} total={total} basePath="/orders" params={{ ...(q ? { q } : {}), ...(status ? { status } : {}) }} />
    </div>
  );
}
