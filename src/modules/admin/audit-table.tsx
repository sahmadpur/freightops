"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import { AUDIT_COUNTRY_FIELDS, AUDIT_FIELD_LABELS } from "@/lib/audit-labels";
import { countryLabel } from "@/lib/countries";
import type { AuditRow } from "./queries";

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const t = useTranslations("admin");
  const tg = useTranslations();
  const format = useFormatter();
  const locale = useLocale();

  // Same labelling as the order History tab — see src/lib/audit-labels.ts.
  const actionLabel = (action: string) =>
    tg.has(`auditAction.${action}`) ? tg(`auditAction.${action}`) : action;

  const entityLabel = (entity: string) =>
    tg.has(`entityType.${entity}`) ? tg(`entityType.${entity}`) : entity;

  const fieldLabel = (field: string) => {
    const key = AUDIT_FIELD_LABELS[field];
    return key && tg.has(`fields.${key}`) ? tg(`fields.${key}`) : field;
  };

  const valueLabel = (field: string | null, value: string | null) => {
    if (value === null || value === "") return "∅";
    if (field === "status") return tg.has(`status.${value}`) ? tg(`status.${value}`) : value;
    if (field === "transportType") {
      return tg.has(`transportTypes.${value}`) ? tg(`transportTypes.${value}`) : value;
    }
    if (field && AUDIT_COUNTRY_FIELDS.has(field)) return countryLabel(value, locale) ?? value;
    return value;
  };

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
    { key: "action", header: t("auditAction"), width: "170px", render: (r) => actionLabel(r.action) },
    {
      key: "entity",
      header: t("auditEntity"),
      width: "160px",
      render: (r) => (
        <span className="text-ink-soft">
          {entityLabel(r.entityType)} <span className="text-edge-chip">·</span>{" "}
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
            {fieldLabel(r.field)}:{" "}
            <span className="text-ink-soft">{valueLabel(r.field, r.oldValue)}</span> →{" "}
            {valueLabel(r.field, r.newValue)}
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
