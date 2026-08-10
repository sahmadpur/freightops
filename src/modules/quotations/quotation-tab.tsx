"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Field, inputCls } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { SectionRule } from "@/components/ui/record";
import { ORDER_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/fx";
import { formatDateTime } from "@/lib/datetime";
import { markQuotationSent, saveQuotation } from "./actions";
import { expectedMargin, type ActionResult } from "./schema";
import type { QuotationRow } from "./queries";

const gridCls = "grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3";

/**
 * The single commercial stage (§13). Internal cost and the client offer are two
 * blocks of one screen, never two steps — the words "pricing" and "quotation"
 * describe the same thing here, and only "quotation" is shown.
 */
export function QuotationTab({
  requestId,
  versions,
  readOnly,
}: {
  requestId: string;
  /** Newest first; `versions[0]` is the current offer. */
  versions: QuotationRow[];
  /** A decided request keeps its commercial record as history. */
  readOnly: boolean;
}) {
  const t = useTranslations("quotations");
  const tf = useTranslations("fields");
  const ta = useTranslations("actions");
  const locale = useLocale();
  const router = useRouter();

  const current = versions[0] ?? null;
  const sent = Boolean(current?.sentAt);

  const [v, setV] = useState({
    currency: current?.currency ?? DEFAULT_CURRENCY,
    expectedCostTotal: current?.expectedCostTotal ?? "",
    sellingPrice: current?.sellingPrice ?? "",
    validUntil: current?.validUntil ?? "",
    transitTimeDays: current?.transitTimeDays == null ? "" : String(current.transitTimeDays),
    terms: current?.terms ?? "",
    notes: current?.notes ?? "",
  });
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const set = (patch: Partial<typeof v>) => setV((s) => ({ ...s, ...patch }));

  async function save() {
    setPending(true);
    const r = await saveQuotation(requestId, v);
    setPending(false);
    setResult(r);
    if (r.ok) router.refresh();
  }

  async function send() {
    setPending(true);
    const r = await markQuotationSent(requestId);
    setPending(false);
    setResult(r);
    if (r.ok) router.refresh();
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const margin = expectedMargin(v.sellingPrice, v.expectedCostTotal);
  const disabled = readOnly || pending;

  return (
    <div className="max-w-3xl space-y-7">
      <section>
        {/* Internal — carrier and supplier rates. Never shown to the client. */}
        <SectionRule>{t("internalCost")}</SectionRule>
        <div className={gridCls}>
          <Field label={tf("currency")} error={fe.currency}>
            <Combobox
              value={v.currency}
              onChange={(value) => set({ currency: value })}
              options={ORDER_CURRENCIES.map((c) => ({ value: c, label: c }))}
              clearable={false}
              disabled={disabled}
            />
          </Field>
          <Field label={t("expectedCost")} error={fe.expectedCostTotal}>
            <input
              className={inputCls}
              value={v.expectedCostTotal}
              disabled={disabled}
              onChange={(e) => set({ expectedCostTotal: e.target.value })}
            />
          </Field>
        </div>
        <p className="text-[11.5px] text-ink-soft">{t("costHint")}</p>
      </section>

      <section>
        <SectionRule>{t("clientOffer")}</SectionRule>
        <div className={gridCls}>
          <Field label={t("sellingPrice")} error={fe.sellingPrice}>
            <input
              className={inputCls}
              value={v.sellingPrice}
              disabled={disabled}
              onChange={(e) => set({ sellingPrice: e.target.value })}
            />
          </Field>
          <Field label={t("validUntil")} error={fe.validUntil}>
            <input
              type="date"
              className={inputCls}
              value={v.validUntil}
              disabled={disabled}
              onChange={(e) => set({ validUntil: e.target.value })}
            />
          </Field>
          <Field label={t("transitTime")} error={fe.transitTimeDays}>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={v.transitTimeDays}
              disabled={disabled}
              onChange={(e) => set({ transitTimeDays: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t("terms")} error={fe.terms}>
          <textarea
            rows={3}
            className={inputCls}
            value={v.terms}
            disabled={disabled}
            onChange={(e) => set({ terms: e.target.value })}
          />
        </Field>
        <Field label={tf("notes")} error={fe.notes}>
          <textarea
            rows={3}
            className={inputCls}
            value={v.notes}
            disabled={disabled}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>

        {margin && (
          <p className="text-[12.5px] text-ink-soft">
            {t("expectedMargin")}:{" "}
            <span className={margin.amount < 0 ? "text-[rgb(var(--danger-fg))]" : "font-medium text-ink"}>
              {margin.amount.toFixed(2)} {v.currency}
              {margin.percent !== null && ` · ${margin.percent.toFixed(1)}%`}
            </span>
          </p>
        )}
      </section>

      {result && !result.ok && result.error && (
        <p className="text-sm text-[rgb(var(--danger-fg))]">
          {result.error === "no_quotation" ? t("nothingToSend") : result.error}
        </p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={pending} className="btn-primary">
            {pending ? ta("saving") : ta("save")}
          </button>
          {/* Sending is what stamps the KPI timestamp, so it is a deliberate act
              rather than a side effect of saving. */}
          <button type="button" onClick={send} disabled={pending || !current} className="btn-secondary">
            {t("markSent")}
          </button>
          {sent && current?.sentAt && (
            <span className="text-[11.5px] text-ink-soft">
              {t("sentAt")}: {formatDateTime(current.sentAt, locale)}
            </span>
          )}
        </div>
      )}

      {versions.length > 1 && (
        <section>
          <SectionRule>{t("versions")}</SectionRule>
          <ul className="space-y-2 text-[12.5px]">
            {versions.map((q) => (
              <li
                key={q.id}
                className="flex items-baseline justify-between gap-4 border-b border-edge-soft pb-2 last:border-0"
              >
                <span>
                  <span className="font-medium">v{q.version}</span>
                  <span className="text-ink-soft">
                    {" · "}
                    {q.sellingPrice ?? "—"} {q.currency}
                  </span>
                </span>
                <span className="whitespace-nowrap font-mono text-[11px] text-ink-soft">
                  {q.sentAt ? formatDateTime(q.sentAt, locale, "short") : t("notSent")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
