"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { MoneyDual } from "@/components/ui/money";
import { toCents } from "@/lib/money";
import { routeLabel } from "@/lib/countries";
import type { PaymentStatus } from "@/lib/finance";
import type { OrderListRow } from "./queries";

/** Day-Month-Year, zero-padded (DD/MM/YYYY) regardless of locale. */
function formatDMY(value: Date | string) {
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const numOrDash = (v: string | null) => (v ? Number(v).toLocaleString("en-US") : "—");

export function OrdersTable({ rows }: { rows: OrderListRow[] }) {
  const t = useTranslations();
  const tp = useTranslations("payStatus");
  const locale = useLocale();

  const payPill = (status: PaymentStatus | null) => {
    if (!status) return <span className="text-ink-soft">—</span>;
    const cls =
      status === "paid"
        ? "bg-[rgb(var(--approval-approved-bg))] text-[rgb(var(--approval-approved-fg))]"
        : status === "partly_paid"
          ? "bg-[rgb(var(--approval-pending-bg))] text-[rgb(var(--approval-pending-fg))]"
          : "bg-[rgb(var(--approval-rejected-bg))] text-[rgb(var(--approval-rejected-fg))]";
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{tp(status)}</span>
    );
  };

  const columns: Column<OrderListRow>[] = [
    {
      key: "number",
      header: t("fields.orderId"),
      width: "120px",
      render: (r) => (
        <Link href={`/orders/${r.id}`} className="font-medium text-brand hover:underline">
          {r.number}
        </Link>
      ),
    },
    { key: "accountTitle", header: t("fields.client"), render: (r) => r.accountTitle },
    { key: "title", header: t("fields.orderTitle"), render: (r) => r.title },
    {
      key: "rollbackNumber",
      header: t("fields.rollbackNumber"),
      width: "120px",
      hiddenOnMobile: true,
      render: (r) => r.rollbackNumber ?? "—",
    },
    {
      key: "route",
      header: t("fields.route"),
      hiddenOnMobile: true,
      render: (r) => routeLabel(r.fromCountry, r.toCountry, locale) ?? "—",
    },
    {
      key: "weightKg",
      header: t("fields.weightKg"),
      width: "100px",
      align: "right",
      hiddenOnMobile: true,
      render: (r) => numOrDash(r.weightKg),
    },
    {
      key: "volumeM3",
      header: t("fields.volumeM3"),
      width: "100px",
      align: "right",
      hiddenOnMobile: true,
      render: (r) => numOrDash(r.volumeM3),
    },
    {
      key: "transportType",
      header: t("fields.transportType"),
      width: "110px",
      hiddenOnMobile: true,
      render: (r) => (r.transportType ? t(`transportTypes.${r.transportType}`) : "—"),
    },
    {
      key: "clientCharge",
      header: t("fields.clientCharge"),
      width: "120px",
      align: "right",
      render: (r) =>
        r.clientCharge ? (
          <MoneyDual cents={toCents(r.clientCharge)} currency={r.currency} rate={r.exchangeRate} />
        ) : (
          "—"
        ),
    },
    {
      key: "carrierCost",
      header: t("fields.carrierCost"),
      width: "120px",
      align: "right",
      hiddenOnMobile: true,
      render: (r) =>
        r.carrierCost ? (
          <MoneyDual cents={toCents(r.carrierCost)} currency={r.currency} rate={r.exchangeRate} />
        ) : (
          "—"
        ),
    },
    {
      key: "receivableStatus",
      header: t("fields.paidByCustomer"),
      width: "120px",
      hiddenOnMobile: true,
      render: (r) => payPill(r.receivableStatus),
    },
    {
      key: "payableStatus",
      header: t("fields.paidToCarrier"),
      width: "120px",
      hiddenOnMobile: true,
      render: (r) => payPill(r.payableStatus),
    },
    {
      key: "hasDocuments",
      header: t("fields.documents"),
      width: "60px",
      align: "center",
      hiddenOnMobile: true,
      render: (r) =>
        r.hasDocuments ? (
          <PaperclipIcon />
        ) : (
          <span className="text-ink-soft">—</span>
        ),
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
      minWidth={1600}
      rowHref={(r) => `/orders/${r.id}`}
      empty={t("orders.empty")}
    />
  );
}

function PaperclipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block h-4 w-4 text-ink-soft"
      aria-hidden="true"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
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
