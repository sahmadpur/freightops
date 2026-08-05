"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls } from "@/components/ui/form";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { SectionRule } from "@/components/ui/record";
import { CUSTOMS_CATEGORIES } from "@/lib/finance-categories";
import { ORDER_CURRENCIES } from "@/lib/fx";
import { convertToAzn, formatMoney, formatMoneyAzn } from "@/lib/money";
import { fetchAznRate } from "@/modules/fx/actions";
import { createCustomsClearance, updateCustomsClearance } from "./actions";
import { customsTotals } from "./totals";
import { emptyCustomsItem, type CustomsFormInitial, type CustomsItemDraft } from "./customs-form-initial";
import type { ActionResult } from "@/lib/forms";

type AccountOpt = { id: string; title: string };
type OrderOpt = {
  id: string;
  number: string;
  title: string;
  accountId: string;
  currency: string;
  exchangeRate: string | null;
};

const gridCls = "grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3";

export function CustomsForm({
  initial,
  accountOpts,
  orderOpts,
}: {
  initial: CustomsFormInitial;
  accountOpts: AccountOpt[];
  orderOpts: OrderOpt[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const set = (patch: Partial<CustomsFormInitial>) => setV((s) => ({ ...s, ...patch }));

  const [rateLoading, setRateLoading] = useState(false);

  async function onCurrencyChange(currency: string) {
    set({ currency });
    if (currency === "AZN") {
      set({ exchangeRate: "1.0000" });
      return;
    }
    setRateLoading(true);
    const rate = await fetchAznRate(
      currency,
      v.clearedAt || new Date().toISOString().slice(0, 10),
    );
    setRateLoading(false);
    if (rate) set({ exchangeRate: rate });
  }

  /** Picking an order inherits its client, currency and rate. */
  function pickOrder(orderId: string) {
    const order = orderOpts.find((o) => o.id === orderId);
    if (!order) return set({ orderId });
    set({
      orderId,
      accountId: order.accountId,
      currency: order.currency,
      exchangeRate: order.exchangeRate ?? v.exchangeRate,
    });
  }

  const setItem = (i: number, patch: Partial<CustomsItemDraft>) =>
    setV((s) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  const totals = customsTotals(v.items);
  const marginAzn = convertToAzn(totals.marginCents, v.exchangeRate);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = {
      // A clearance is either attached to an order or standalone — never send
      // a stale order id after switching back to standalone.
      orderId: v.mode === "order" ? v.orderId : "",
      accountId: v.accountId,
      declarationNumber: v.declarationNumber,
      description: v.description,
      currency: v.currency,
      exchangeRate: v.exchangeRate,
      clearedAt: v.clearedAt,
      notes: v.notes,
      items: v.items,
    };
    const r = v.id
      ? await updateCustomsClearance(v.id, payload)
      : await createCustomsClearance(payload);
    setPending(false);
    setResult(r);
    if (r.ok) router.push(`/customs/${r.id}`);
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const orderCombo: ComboOption[] = orderOpts.map((o) => ({
    value: o.id,
    label: `${o.number} — ${o.title}`,
  }));
  const accountCombo: ComboOption[] = accountOpts.map((a) => ({ value: a.id, label: a.title }));

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-[1400px] pb-24">
      <section className="mb-8">
        <SectionRule>{t("customs.sectionSubject")}</SectionRule>
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          {(["order", "standalone"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="customsMode"
                checked={v.mode === m}
                onChange={() => set({ mode: m })}
              />
              {m === "order" ? t("customs.forOrder") : t("customs.standalone")}
            </label>
          ))}
        </div>
        <div className={gridCls}>
          {v.mode === "order" && (
            <Field label={t("customs.order")} htmlFor="orderId" error={fe.orderId}>
              <Combobox
                id="orderId"
                value={v.orderId}
                onChange={pickOrder}
                options={orderCombo}
                placeholder={t("customs.selectOrder")}
                emptyLabel={t("common.noResults")}
              />
            </Field>
          )}
          <Field label={t("fields.client")} htmlFor="accountId" error={fe.accountId}>
            <Combobox
              id="accountId"
              value={v.accountId}
              onChange={(value) => set({ accountId: value })}
              options={accountCombo}
              placeholder={t("fields.selectAccount")}
              emptyLabel={t("common.noResults")}
            />
          </Field>
          <Field
            label={t("customs.declarationNumber")}
            htmlFor="declarationNumber"
            error={fe.declarationNumber}
          >
            <input
              id="declarationNumber"
              className={inputCls}
              value={v.declarationNumber}
              onChange={(e) => set({ declarationNumber: e.target.value })}
            />
          </Field>
          <Field label={t("customs.clearedAt")} htmlFor="clearedAt" error={fe.clearedAt}>
            <input
              id="clearedAt"
              type="date"
              className={inputCls}
              value={v.clearedAt}
              onChange={(e) => set({ clearedAt: e.target.value })}
            />
          </Field>
          <Field
            label={t("customs.description")}
            htmlFor="description"
            error={fe.description}
            className="sm:col-span-2"
          >
            <input
              id="description"
              className={inputCls}
              value={v.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <Field label={t("fields.currency")} htmlFor="currency" error={fe.currency}>
            <select
              id="currency"
              className={inputCls}
              value={v.currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
            >
              {ORDER_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label={t("fields.exchangeRate")} htmlFor="exchangeRate" error={fe.exchangeRate}>
            <input
              id="exchangeRate"
              className={inputCls}
              placeholder={rateLoading ? t("fields.loadingRate") : `AZN / 1 ${v.currency}`}
              value={v.exchangeRate}
              onChange={(e) => set({ exchangeRate: e.target.value })}
            />
          </Field>
          <Field label={t("fields.notes")} htmlFor="notes" error={fe.notes} className="sm:col-span-2 lg:col-span-3">
            <input id="notes" className={inputCls} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <SectionRule>{t("customs.costs")}</SectionRule>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => setV((s) => ({ ...s, items: [...s.items, emptyCustomsItem()] }))}
          >
            + {t("customs.addItem")}
          </button>
        </div>

        {v.items.length === 0 ? (
          <p className="text-[12px] text-ink-soft">{t("customs.noItems")}</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_130px_130px_minmax(0,1fr)_auto] gap-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft sm:grid">
              <span>{t("customs.category")}</span>
              <span>{t("customs.buy")}</span>
              <span>{t("customs.sell")}</span>
              <span>{t("fields.note")}</span>
              <span />
            </div>
            {v.items.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_130px_130px_minmax(0,1fr)_auto]"
              >
                <select
                  aria-label={t("customs.category")}
                  className={inputCls}
                  value={item.category}
                  onChange={(e) => setItem(i, { category: e.target.value })}
                >
                  {CUSTOMS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(`customsCategory.${c}`)}</option>
                  ))}
                </select>
                <input
                  aria-label={t("customs.buy")}
                  className={inputCls}
                  placeholder="0.00"
                  value={item.buyAmount}
                  onChange={(e) => setItem(i, { buyAmount: e.target.value })}
                />
                <input
                  aria-label={t("customs.sell")}
                  className={inputCls}
                  placeholder="0.00"
                  value={item.sellAmount}
                  onChange={(e) => setItem(i, { sellAmount: e.target.value })}
                />
                <input
                  aria-label={t("fields.note")}
                  className={inputCls}
                  value={item.note}
                  onChange={(e) => setItem(i, { note: e.target.value })}
                />
                <button
                  type="button"
                  className="px-2 text-ink-soft hover:text-[rgb(var(--danger-fg))]"
                  aria-label={t("fields.remove")}
                  onClick={() => setV((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }))}
                >
                  ×
                </button>
              </div>
            ))}

            <dl className="ml-auto mt-3 w-full max-w-xs space-y-1 text-[13px]">
              <Total label={t("customs.totalBuy")} value={formatMoney(totals.buyCents, v.currency)} />
              <Total label={t("customs.totalSell")} value={formatMoney(totals.sellCents, v.currency)} />
              <div className="border-t border-edge-soft pt-1">
                <Total
                  label={t("customs.margin")}
                  value={formatMoney(totals.marginCents, v.currency)}
                  strong
                  negative={totals.marginCents < 0}
                />
                {marginAzn !== null && v.currency !== "AZN" && (
                  <Total label="AZN" value={formatMoneyAzn(marginAzn)} muted />
                )}
              </div>
            </dl>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 mt-8 flex items-center justify-end gap-2 border-t border-edge-soft bg-surface/90 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        {result && !result.ok && result.error && (
          <p className="mr-auto text-sm text-[rgb(var(--danger-fg))]">{result.error}</p>
        )}
        <a href={v.id ? `/customs/${v.id}` : "/customs"} className="btn-secondary">
          {t("actions.cancel")}
        </a>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t("actions.saving") : t("actions.save")}
        </button>
      </div>
    </form>
  );
}

function Total({
  label,
  value,
  strong,
  negative,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={muted ? "text-[11px] text-ink-soft" : "text-ink-soft"}>{label}</dt>
      <dd
        className={`tabular-nums ${muted ? "text-[11px] text-ink-soft" : ""} ${
          strong ? "font-semibold" : ""
        } ${negative ? "text-rose-600" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
