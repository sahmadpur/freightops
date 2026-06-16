"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { AccountListRow } from "./queries";

export function AccountsTable({ rows }: { rows: AccountListRow[] }) {
  const t = useTranslations();

  const columns: Column<AccountListRow>[] = [
    { key: "title", header: t("fields.companyTitle"), render: (r) => <span className="font-medium">{r.title}</span> },
    { key: "taxId", header: t("fields.taxId"), width: "130px", hiddenOnMobile: true, render: (r) => <span className="text-ink-soft">{r.taxId ?? "—"}</span> },
    { key: "contact1", header: `${t("fields.contacts")} 1`, hiddenOnMobile: true, render: (r) => r.contact1?.name ?? "—" },
    { key: "contact2", header: `${t("fields.contacts")} 2`, hiddenOnMobile: true, render: (r) => r.contact2Name ?? "—" },
    { key: "phones", header: t("fields.phones"), hiddenOnMobile: true, render: (r) => r.contact1?.phone ?? "—" },
    { key: "emails", header: t("fields.emails"), hiddenOnMobile: true, render: (r) => r.contact1?.email ?? "—" },
    { key: "orders", header: t("fields.orders"), width: "80px", align: "right", render: (r) => r.orderCount },
    {
      key: "actions",
      header: t("fields.actionsCol"),
      width: "100px",
      render: (r) => (
        <span className="flex gap-2 text-xs">
          <Link className="text-brand hover:underline" href={`/accounts/${r.id}`}>{t("actions.view")}</Link>
          <Link className="text-brand hover:underline" href={`/accounts/${r.id}/edit`}>{t("actions.edit")}</Link>
        </span>
      ),
    },
  ];

  return (
    <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} storageKey="accounts" empty={t("accounts.empty")} />
  );
}
