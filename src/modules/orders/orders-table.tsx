"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { OrderListRow } from "./queries";

/** Day-Month-Year, zero-padded (DD/MM/YYYY) regardless of locale. */
function formatDMY(value: Date | string) {
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function OrdersTable({ rows }: { rows: OrderListRow[] }) {
  const t = useTranslations();

  const columns: Column<OrderListRow>[] = [
    {
      key: "number",
      header: t("fields.orderId"),
      width: "120px",
      render: (r) => <span className="font-medium text-brand">{r.number}</span>,
    },
    { key: "accountTitle", header: t("fields.client"), render: (r) => r.accountTitle },
    { key: "title", header: t("fields.orderTitle"), render: (r) => r.title },
    {
      key: "route",
      header: t("fields.route"),
      hiddenOnMobile: true,
      render: (r) => r.route ?? "—",
    },
    {
      key: "transportNumber",
      header: t("fields.transport"),
      width: "110px",
      hiddenOnMobile: true,
      render: (r) => r.transportNumber ?? "—",
    },
    {
      key: "clientCharge",
      header: t("fields.clientCharge"),
      width: "110px",
      align: "right",
      render: (r) =>
        r.clientCharge ? `$${Number(r.clientCharge).toLocaleString("en-US")}` : "—",
    },
    {
      key: "createdAt",
      header: t("fields.createdAt"),
      width: "120px",
      hiddenOnMobile: true,
      render: (r) => (
        <span className="whitespace-nowrap text-ink-soft">{formatDMY(r.createdAt)}</span>
      ),
    },
    {
      key: "status",
      header: t("fields.status"),
      width: "140px",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "",
      width: "84px",
      align: "right",
      render: (r) => (
        <span className="flex items-center justify-end gap-3">
          <Link
            href={`/orders/${r.id}`}
            aria-label={t("actions.view")}
            title={t("actions.view")}
            className="text-ink-soft transition-colors hover:text-brand"
          >
            <EyeIcon />
          </Link>
          <Link
            href={`/orders/${r.id}/edit`}
            aria-label={t("actions.edit")}
            title={t("actions.edit")}
            className="text-ink-soft transition-colors hover:text-brand"
          >
            <PencilIcon />
          </Link>
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      storageKey="orders"
      minWidth={1000}
      empty={t("orders.empty")}
    />
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
