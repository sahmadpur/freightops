"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { AuditRow } from "./queries";

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const t = useTranslations("admin");
  const format = useFormatter();

  const columns: Column<AuditRow>[] = [
    {
      key: "createdAt",
      header: t("auditTime"),
      width: "150px",
      render: (r) => (
        <span className="whitespace-nowrap text-ink-soft">
          {format.dateTime(r.createdAt, { dateStyle: "short", timeStyle: "short" })}
        </span>
      ),
    },
    { key: "actor", header: t("auditActor"), width: "160px", hiddenOnMobile: true, render: (r) => r.actorName ?? r.actorEmail ?? "—" },
    { key: "action", header: t("auditAction"), width: "130px", render: (r) => r.action },
    {
      key: "entity",
      header: t("auditEntity"),
      width: "160px",
      render: (r) => (
        <span className="text-ink-soft">
          {r.entityType} <span className="text-edge-chip">·</span>{" "}
          <span className="font-mono text-[11px]">{r.entityId.slice(0, 8)}</span>
        </span>
      ),
    },
    {
      key: "change",
      header: t("auditChange"),
      hiddenOnMobile: true,
      render: (r) =>
        r.field ? (
          <span>
            {r.field}: <span className="text-ink-soft">{r.oldValue ?? "∅"}</span> → {r.newValue ?? "∅"}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} storageKey="audit" minWidth={760} empty={t("noAuditEntries")} />
  );
}
