import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { RequestsTable } from "@/modules/requests/requests-table";
import { RequestFilters, type RequestFilterValues } from "@/modules/requests/request-filters";
import { listRequests, requestFilterData } from "@/modules/requests/queries";
import { REQUEST_STATUSES } from "@/lib/request-status";

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
  archived?: string;
  accountId?: string;
  responsibleUserId?: string;
  source?: string;
  family?: string;
  from?: string;
  to?: string;
  dateFrom?: string;
  dateTo?: string;
};

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = sp.status || undefined;
  const page = Number(sp.page) || 1;
  const archived = sp.archived === "1";

  const filters: RequestFilterValues = {
    accountId: sp.accountId ?? "",
    responsibleUserId: sp.responsibleUserId ?? "",
    source: sp.source ?? "",
    family: sp.family ?? "",
    from: sp.from ?? "",
    to: sp.to ?? "",
    dateFrom: sp.dateFrom ?? "",
    dateTo: sp.dateTo ?? "",
  };

  const t = await getTranslations();
  const [{ rows, total }, filterData] = await Promise.all([
    listRequests({
      q,
      status,
      page,
      archived,
      accountId: filters.accountId || undefined,
      responsibleUserId: filters.responsibleUserId || undefined,
      leadSource: filters.source || undefined,
      transportFamily: filters.family || undefined,
      fromCountry: filters.from || undefined,
      toCountry: filters.to || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
    requestFilterData(),
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
    const href = params.toString() ? `/requests?${params}` : "/requests";
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
        title={t("requests.title")}
        action={
          <Link href="/requests/new" className="btn-primary">
            + {t("requests.newRequest")}
          </Link>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {pill(t("requests.allRequests"), undefined, !status)}
        {REQUEST_STATUSES.map((s) => pill(t(`status.${s}`), s, status === s))}
        <Link
          href={archiveParams.toString() ? `/requests?${archiveParams}` : "/requests"}
          className={`ml-auto rounded-full border px-3 py-1 text-xs ${archived ? "border-indigo-600 bg-indigo-600 text-brand-pale" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
        >
          {archived ? t("actions.showActive") : t("actions.showArchived")}
        </Link>
      </div>

      <RequestFilters
        values={filters}
        accountOpts={filterData.accountOpts}
        staffOpts={filterData.staffOpts}
        fromCountries={filterData.fromCountries}
        toCountries={filterData.toCountries}
        q={q}
        status={status}
        archived={archived}
      />

      <RequestsTable rows={rows} empty={t("requests.empty")} />
      <Paginator
        page={page}
        total={total}
        basePath="/requests"
        params={{ ...activeParams, ...(status ? { status } : {}) }}
      />
    </div>
  );
}
