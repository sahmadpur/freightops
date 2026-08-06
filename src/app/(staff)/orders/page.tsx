import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { OrdersTable } from "@/modules/orders/orders-table";
import { OrderFilters, type OrderFilterValues } from "@/modules/orders/order-filters";
import { listOrders, orderFilterData } from "@/modules/orders/queries";
import { ORDER_STATUSES } from "@/lib/order-status";

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
  archived?: string;
  accountId?: string;
  carrierId?: string;
  from?: string;
  to?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  pay?: string;
  payTo?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = sp.status || undefined;
  const page = Number(sp.page) || 1;
  const archived = sp.archived === "1";

  const filters: OrderFilterValues = {
    accountId: sp.accountId ?? "",
    carrierId: sp.carrierId ?? "",
    from: sp.from ?? "",
    to: sp.to ?? "",
    type: sp.type ?? "",
    dateFrom: sp.dateFrom ?? "",
    dateTo: sp.dateTo ?? "",
    pay: sp.pay ?? "",
    payTo: sp.payTo ?? "",
  };

  const t = await getTranslations();
  const [{ rows, total }, filterData] = await Promise.all([
    listOrders({ q, status, page, archived, ...filters }),
    orderFilterData(),
  ]);

  // Every link out of this page keeps the current query so paging and status
  // pills don't silently drop the user's filters.
  const activeParams: Record<string, string> = {
    ...(q ? { q } : {}),
    ...(archived ? { archived: "1" } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  };

  const pill = (label: string, value: string | undefined, active: boolean) => {
    const params = new URLSearchParams(activeParams);
    if (value) params.set("status", value);
    const href = params.toString() ? `/orders?${params}` : "/orders";
    return (
      <Link
        key={label}
        href={href}
        className={`rounded-full border px-3 py-1 text-xs ${active ? "border-indigo-600 bg-indigo-600 text-brand-pale" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
      >
        {label}
      </Link>
    );
  };

  const archiveParams = new URLSearchParams(activeParams);
  archiveParams.delete("archived");
  if (!archived) archiveParams.set("archived", "1");
  if (status) archiveParams.set("status", status);

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
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {pill(t("orders.allOrders"), undefined, !status)}
        {ORDER_STATUSES.map((s) => pill(t(`status.${s}`), s, status === s))}
        <Link
          href={archiveParams.toString() ? `/orders?${archiveParams}` : "/orders"}
          className={`ml-auto rounded-full border px-3 py-1 text-xs ${archived ? "border-indigo-600 bg-indigo-600 text-brand-pale" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
        >
          {archived ? t("actions.showActive") : t("actions.showArchived")}
        </Link>
      </div>

      <OrderFilters
        values={filters}
        accountOpts={filterData.accountOpts}
        carrierOpts={filterData.carrierOpts}
        countries={filterData.countries}
        q={q}
        status={status}
        archived={archived}
      />

      <OrdersTable rows={rows} />
      <Paginator
        page={page}
        total={total}
        basePath="/orders"
        params={{ ...activeParams, ...(status ? { status } : {}) }}
      />
    </div>
  );
}
