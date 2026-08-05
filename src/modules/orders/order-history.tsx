"use client";

import { useLocale, useTranslations } from "next-intl";
import { SectionRule } from "@/components/ui/record";
import { countryLabel } from "@/lib/countries";
import { formatDateTime } from "@/lib/datetime";
import { AUDIT_COUNTRY_FIELDS, AUDIT_FIELD_LABELS } from "@/lib/audit-labels";
import type { OrderHistoryEntry } from "./queries";

export function OrderHistory({ entries }: { entries: OrderHistoryEntry[] }) {
  const t = useTranslations();
  const locale = useLocale();

  const fieldLabel = (field: string) => {
    const key = AUDIT_FIELD_LABELS[field];
    return key && t.has(`fields.${key}`) ? t(`fields.${key}`) : field;
  };

  const actionLabel = (action: string) =>
    t.has(`auditAction.${action}`) ? t(`auditAction.${action}`) : action;

  /** Render a stored value the way the UI shows it elsewhere. */
  const valueLabel = (field: string | null, value: string | null) => {
    if (value === null || value === "") return "∅";
    if (field === "status") return t.has(`status.${value}`) ? t(`status.${value}`) : value;
    if (field === "transportType") {
      return t.has(`transportTypes.${value}`) ? t(`transportTypes.${value}`) : value;
    }
    if (field && AUDIT_COUNTRY_FIELDS.has(field)) return countryLabel(value, locale) ?? value;
    return value;
  };

  return (
    <section>
      <SectionRule>{t("orders.deliveryHistory")}</SectionRule>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-soft">{t("orders.noHistory")}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {entries.map((h) => (
            <li
              key={h.id}
              className="flex items-baseline justify-between gap-4 border-b border-edge-soft pb-2 last:border-0"
            >
              <span className="min-w-0">
                <span className="font-medium">{h.userName ?? t("orders.systemActor")}</span>
                <span className="text-ink-soft"> · {actionLabel(h.action)}</span>
                {h.field && (
                  <span className="text-ink-soft">
                    {" · "}
                    {fieldLabel(h.field)}: {valueLabel(h.field, h.oldValue)} →{" "}
                    {valueLabel(h.field, h.newValue)}
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap font-mono text-[11px] text-ink-soft">
                {formatDateTime(h.createdAt, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
