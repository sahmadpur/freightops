"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MoneyDual } from "@/components/ui/money";
import { formatMoney } from "@/lib/money";
import type { CustomsListRow } from "./queries";

export function CustomsTable({ rows }: { rows: CustomsListRow[] }) {
  const t = useTranslations();

  const columns: Column<CustomsListRow>[] = [
    {
      key: "number",
      header: t("customs.number"),
      width: "120px",
      render: (r) => (
        <Link href={`/customs/${r.id}`} className="font-medium text-brand hover:underline">
          {r.number}
        </Link>
      ),
    },
    {
      key: "declarationNumber",
      header: t("customs.declarationNumber"),
      width: "150px",
      hiddenOnMobile: true,
      render: (r) => r.declarationNumber ?? "—",
    },
    {
      key: "orderNumber",
      header: t("customs.order"),
      width: "120px",
      render: (r) =>
        r.orderNumber ? (
          <span className="font-mono text-[11px]">{r.orderNumber}</span>
        ) : (
          <span className="text-ink-soft">{t("customs.standalone")}</span>
        ),
    },
    { key: "accountTitle", header: t("fields.client"), render: (r) => r.accountTitle ?? "—" },
    {
      key: "description",
      header: t("customs.description"),
      hiddenOnMobile: true,
      render: (r) => r.description ?? "—",
    },
    {
      key: "buy",
      header: t("customs.totalBuy"),
      width: "120px",
      align: "right",
      hiddenOnMobile: true,
      render: (r) => formatMoney(r.buyCents, r.currency),
    },
    {
      key: "sell",
      header: t("customs.totalSell"),
      width: "120px",
      align: "right",
      render: (r) => formatMoney(r.sellCents, r.currency),
    },
    {
      key: "margin",
      header: t("customs.margin"),
      width: "130px",
      align: "right",
      render: (r) => (
        <span className={r.marginCents < 0 ? "text-rose-600" : "text-emerald-600"}>
          <MoneyDual cents={r.marginCents} currency={r.currency} rate={r.exchangeRate} />
        </span>
      ),
    },
    {
      key: "clearedAt",
      header: t("customs.clearedAt"),
      width: "120px",
      hiddenOnMobile: true,
      render: (r) => <span className="whitespace-nowrap text-ink-soft">{r.clearedAt ?? "—"}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      storageKey="customs"
      minWidth={1200}
      rowHref={(r) => `/customs/${r.id}`}
      empty={t("customs.empty")}
    />
  );
}
