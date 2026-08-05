"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { routeLabel } from "@/lib/countries";
import type { ClientOrderListRow } from "./queries";

export function ClientOrdersTable({ rows }: { rows: ClientOrderListRow[] }) {
  const t = useTranslations();
  const locale = useLocale();

  const columns: Column<ClientOrderListRow>[] = [
    {
      key: "number",
      header: t("fields.orderId"),
      width: "130px",
      render: (r) => (
        <Link href={`/portal/orders/${r.id}`} className="font-medium text-brand hover:underline">
          {r.number}
        </Link>
      ),
    },
    { key: "title", header: t("fields.orderTitle"), render: (r) => r.title },
    { key: "route", header: t("fields.route"), hiddenOnMobile: true, render: (r) => <span className="text-ink-soft">{routeLabel(r.fromCountry, r.toCountry, locale) ?? "—"}</span> },
    { key: "status", header: t("fields.status"), width: "140px", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} storageKey="portal-orders" minWidth={640} rowHref={(r) => `/portal/orders/${r.id}`} empty={t("portal.noOrders")} />
  );
}
