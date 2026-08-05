"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { SectionRule } from "@/components/ui/record";
import { countryLabel } from "@/lib/countries";
import type { OrderHistoryEntry } from "./queries";

/**
 * Audited field name → key in the shared `fields` i18n namespace. Anything not
 * listed falls back to the raw field name, so a newly audited field shows up
 * readably rather than breaking the tab.
 */
const FIELD_LABELS: Record<string, string> = {
  title: "orderTitle",
  rollbackNumber: "rollbackNumber",
  accountId: "client",
  carrierId: "carrier",
  transportType: "transportType",
  fromCountry: "fromCountry",
  toCountry: "toCountry",
  cargoItems: "cargoDescription",
  packages: "packages",
  weightKg: "weightKg",
  volumeM3: "volumeM3",
  incoterms: "incoterms",
  deliveryFormat: "deliveryFormat",
  currency: "currency",
  exchangeRate: "exchangeRate",
  status: "status",
  amountReceivable: "amountReceivable",
  amountPayable: "amountPayable",
  carrierInvoiceNumber: "carrierInvoiceNumber",
  carrierInvoiceDate: "carrierInvoiceDate",
  invoiceNumber: "invoiceNumber",
  actNumber: "actNumber",
  received: "received",
  paid: "paid",
  revenue: "revenue",
  cost: "cost",
};

const COUNTRY_FIELDS = new Set(["fromCountry", "toCountry"]);

export function OrderHistory({ entries }: { entries: OrderHistoryEntry[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();

  const fieldLabel = (field: string) => {
    const key = FIELD_LABELS[field];
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
    if (field && COUNTRY_FIELDS.has(field)) return countryLabel(value, locale) ?? value;
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
                {format.dateTime(h.createdAt, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
