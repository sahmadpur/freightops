"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/datetime";
import { countryLabel } from "@/lib/countries";
import type { RequestListRow } from "./queries";

/**
 * The place a leg names: its city when known, otherwise the country. Requests
 * routinely arrive with only a country, so falling back keeps the route column
 * meaningful instead of blank.
 */
function place(city: string | null, country: string | null, locale: string): string | null {
  return city || countryLabel(country, locale);
}

export function RequestsTable({ rows, empty }: { rows: RequestListRow[]; empty: string }) {
  const t = useTranslations("fields");
  const tls = useTranslations("leadSource");
  const tf = useTranslations("transportFamily");
  const locale = useLocale();

  const columns: Column<RequestListRow>[] = [
    {
      key: "number",
      header: t("requestId"),
      width: "150px",
      render: (r) => (
        <Link href={`/requests/${r.id}`} className="font-medium text-brand hover:underline">
          {r.number}
        </Link>
      ),
    },
    {
      key: "route",
      header: t("route"),
      render: (r) => {
        const from = place(r.originCity, r.originCountry, locale);
        const to = place(r.destinationCity, r.destinationCountry, locale);
        const route = from || to ? `${from ?? "—"} → ${to ?? "—"}` : null;
        return (
          <div className="min-w-0">
            <div className="truncate">{r.title}</div>
            {(route || r.transportFamily) && (
              <div className="truncate text-[11.5px] text-ink-soft">
                {[route, r.transportFamily ? tf(r.transportFamily) : null].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        );
      },
    },
    { key: "accountTitle", header: t("client"), render: (r) => r.accountTitle ?? "—" },
    {
      key: "leadSource",
      header: t("source"),
      width: "110px",
      hiddenOnMobile: true,
      render: (r) => tls(r.leadSource),
    },
    {
      key: "status",
      header: t("status"),
      width: "150px",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "responsible",
      header: t("responsible"),
      width: "150px",
      hiddenOnMobile: true,
      render: (r) => r.responsibleName ?? "—",
    },
    {
      key: "receivedAt",
      header: t("receivedAt"),
      width: "170px",
      render: (r) => formatDateTime(r.receivedAt, locale, "short"),
    },
    {
      key: "lastActivityAt",
      header: t("lastActivity"),
      width: "170px",
      hiddenOnMobile: true,
      render: (r) => formatDateTime(r.lastActivityAt, locale, "short"),
    },
    {
      key: "order",
      header: t("orderId"),
      width: "150px",
      hiddenOnMobile: true,
      render: (r) =>
        r.orderId && r.orderNumber ? (
          <Link href={`/orders/${r.orderId}`} className="text-brand hover:underline">
            {r.orderNumber}
          </Link>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/requests/${r.id}`}
      storageKey="requests"
      minWidth={1500}
      empty={empty}
    />
  );
}
