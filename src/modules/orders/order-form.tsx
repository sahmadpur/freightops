"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Field, inputCls } from "@/components/ui/form";
import { Combobox, MultiCombobox, type ComboOption } from "@/components/ui/combobox";
import { FilePicker } from "@/components/ui/file-picker";
import { SectionRule } from "@/components/ui/record";
import { createOrder, updateOrder } from "./actions";
import { uploadDocument } from "@/modules/documents/actions";
import { fetchAznRate } from "@/modules/fx/actions";
import { TRANSPORT_TYPES } from "@/lib/transport-types";
import { countryOptions } from "@/lib/countries";
import { ORDER_CURRENCIES } from "@/lib/fx";
import { CARGO_TYPES } from "@/lib/cargo-types";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import { convertToAzn, formatMoneyAzn, toCents } from "@/lib/money";
import { emptyCostLine, type OrderFormInitial } from "./order-form-initial";
import type { ActionResult } from "@/lib/forms";

const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
const DELIVERY_FORMATS = ["FCL", "LCL", "FTL", "LTL"] as const;

type Option = { id: string; title?: string };

const gridCls = "grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3";

export function OrderForm({
  initial,
  accountOpts,
  carrierOpts,
}: {
  initial: OrderFormInitial;
  accountOpts: Option[];
  carrierOpts: Option[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const set = (patch: Partial<OrderFormInitial>) => setV((s) => ({ ...s, ...patch }));

  const countries = useMemo(() => countryOptions(locale), [locale]);
  const toOpts = (rows: Option[]): ComboOption[] =>
    rows.map((r) => ({ value: r.id, label: r.title ?? r.id }));
  const cargoOpts: ComboOption[] = CARGO_TYPES.map((key) => ({
    value: t(`cargoTypes.${key}`),
    label: t(`cargoTypes.${key}`),
  }));

  // The manat rate is seeded server-side for the initial currency and refreshed
  // from the CBAR bulletin whenever the currency changes. Always overwritable —
  // the field stays a plain input. On an existing order nothing is fetched
  // unless the user actually changes the currency, so opening the edit form
  // never silently replaces the rate the order was booked at.
  const [rateLoading, setRateLoading] = useState(false);

  async function onCurrencyChange(currency: string) {
    set({ currency });
    if (currency === "AZN") {
      set({ exchangeRate: "1.0000" });
      return;
    }
    setRateLoading(true);
    const rate = await fetchAznRate(currency, new Date().toISOString().slice(0, 10));
    setRateLoading(false);
    if (rate) set({ exchangeRate: rate });
  }

  const costTotalCents = v.costLines.reduce((sum, l) => sum + toCents(l.amount), 0);
  const chargeCents = toCents(v.clientCharge);
  const chargeAzn = convertToAzn(chargeCents, v.exchangeRate);

  const setCostLine = (i: number, patch: Partial<OrderFormInitial["costLines"][number]>) =>
    setV((s) => ({
      ...s,
      costLines: s.costLines.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setUploadError(null);
    const payload = {
      transportType: v.transportType,
      accountId: v.accountId,
      carrierId: v.carrierId,
      fromCountry: v.fromCountry,
      toCountry: v.toCountry,
      title: v.title,
      rollbackNumber: v.rollbackNumber,
      deliveryFormat: v.deliveryFormat,
      cargoItems: v.cargoItems,
      packages: v.packages,
      weightKg: v.weightKg,
      volumeM3: v.volumeM3,
      incoterms: v.incoterms,
      currency: v.currency,
      exchangeRate: v.exchangeRate,
      clientCharge: v.clientCharge,
      costLines: v.costLines.filter((l) => l.amount.trim() !== ""),
    };
    const r = v.id ? await updateOrder(v.id, payload) : await createOrder(payload);
    if (!r.ok) {
      setPending(false);
      setResult(r);
      return;
    }
    // Documents can only be attached once the order exists, so upload after the
    // create succeeds. A failure here does NOT undo the order — say so plainly.
    const failed: string[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("parentType", "order");
      fd.set("parentId", r.id);
      fd.set("docType", "other");
      const up = await uploadDocument(fd);
      if (!up.ok) failed.push(file.name);
    }
    if (failed.length > 0) {
      setPending(false);
      setResult(r);
      setUploadError(t("documents.uploadFailedAfterCreate", { files: failed.join(", ") }));
      return;
    }
    router.push(`/orders/${r.id}`);
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-[1400px] pb-24">
      <section className="mb-8">
        <SectionRule>{t("orders.sectionConsignment")}</SectionRule>
        <div className={gridCls}>
          <Field label={t("fields.transportType")} htmlFor="transportType" error={fe.transportType}>
            <Combobox
              id="transportType"
              value={v.transportType}
              onChange={(value) => set({ transportType: value })}
              options={TRANSPORT_TYPES.map((m) => ({ value: m, label: t(`transportTypes.${m}`) }))}
              placeholder={t("fields.selectTransportType")}
              emptyLabel={t("common.noResults")}
            />
          </Field>
          <Field label={t("fields.client")} htmlFor="accountId" error={fe.accountId}>
            <Combobox
              id="accountId"
              value={v.accountId}
              onChange={(value) => set({ accountId: value })}
              options={toOpts(accountOpts)}
              placeholder={t("fields.selectAccount")}
              emptyLabel={t("common.noResults")}
            />
          </Field>
          <Field label={t("fields.carrier")} htmlFor="carrierId" error={fe.carrierId}>
            <Combobox
              id="carrierId"
              value={v.carrierId}
              onChange={(value) => set({ carrierId: value })}
              options={toOpts(carrierOpts)}
              placeholder={t("fields.selectCarrier")}
              emptyLabel={t("common.noResults")}
            />
          </Field>
          <Field label={t("fields.fromCountry")} htmlFor="fromCountry" error={fe.fromCountry}>
            <Combobox
              id="fromCountry"
              value={v.fromCountry}
              onChange={(value) => set({ fromCountry: value })}
              options={countries}
              placeholder={t("fields.selectCountry")}
              emptyLabel={t("common.noResults")}
            />
          </Field>
          <Field label={t("fields.toCountry")} htmlFor="toCountry" error={fe.toCountry}>
            <Combobox
              id="toCountry"
              value={v.toCountry}
              onChange={(value) => set({ toCountry: value })}
              options={countries}
              placeholder={t("fields.selectCountry")}
              emptyLabel={t("common.noResults")}
            />
          </Field>
          <Field label={t("fields.orderTitle")} htmlFor="title" error={fe.title}>
            <input id="title" required className={inputCls} value={v.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={t("fields.rollbackNumber")} htmlFor="rollbackNumber" error={fe.rollbackNumber}>
            <input id="rollbackNumber" className={inputCls} value={v.rollbackNumber} onChange={(e) => set({ rollbackNumber: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="mb-8">
        <SectionRule>{t("orders.sectionCargo")}</SectionRule>
        <div className={gridCls}>
          <Field label={t("fields.cargoDescription")} htmlFor="cargoItems" error={fe.cargoItems} className="sm:col-span-2 lg:col-span-3">
            <MultiCombobox
              id="cargoItems"
              values={v.cargoItems}
              onChange={(values) => set({ cargoItems: values })}
              options={cargoOpts}
              creatable
              placeholder={t("fields.selectCargo")}
              emptyLabel={t("common.noResults")}
            />
          </Field>
          <Field label={t("fields.deliveryFormat")} htmlFor="deliveryFormat" error={fe.deliveryFormat}>
            <select id="deliveryFormat" className={inputCls} value={v.deliveryFormat} onChange={(e) => set({ deliveryFormat: e.target.value })}>
              <option value="">—</option>
              {DELIVERY_FORMATS.map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
          </Field>
          <Field label={t("fields.packages")} htmlFor="packages" error={fe.packages}>
            <input id="packages" className={inputCls} value={v.packages} onChange={(e) => set({ packages: e.target.value })} />
          </Field>
          <Field label={t("fields.weightKg")} htmlFor="weightKg" error={fe.weightKg}>
            <input id="weightKg" className={inputCls} value={v.weightKg} onChange={(e) => set({ weightKg: e.target.value })} />
          </Field>
          <Field label={t("fields.volumeM3")} htmlFor="volumeM3" error={fe.volumeM3}>
            <input id="volumeM3" className={inputCls} value={v.volumeM3} onChange={(e) => set({ volumeM3: e.target.value })} />
          </Field>
          <Field label={t("fields.incoterms")} htmlFor="incoterms" error={fe.incoterms}>
            <select id="incoterms" className={inputCls} value={v.incoterms} onChange={(e) => set({ incoterms: e.target.value })}>
              <option value="">—</option>
              {INCOTERMS.map((i) => (<option key={i} value={i}>{i}</option>))}
            </select>
          </Field>
        </div>
      </section>

      <section className="mb-8">
        <SectionRule>{t("nav.finance")}</SectionRule>
        <div className={gridCls}>
          <Field label={t("fields.currency")} htmlFor="currency" error={fe.currency}>
            <select id="currency" className={inputCls} value={v.currency} onChange={(e) => onCurrencyChange(e.target.value)}>
              {ORDER_CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
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
            <p className="mt-1 text-[11px] text-ink-soft">
              {t("fields.rateSource")}
            </p>
          </Field>
          {!v.id && (
            <Field label={t("fields.clientCharge")} htmlFor="clientCharge" error={fe.clientCharge}>
              <input id="clientCharge" className={inputCls} value={v.clientCharge} onChange={(e) => set({ clientCharge: e.target.value })} />
              {chargeAzn !== null && v.currency !== "AZN" && (
                <p className="mt-1 font-mono text-[11px] text-ink-soft">
                  = {formatMoneyAzn(chargeAzn)}
                </p>
              )}
            </Field>
          )}
        </div>

        {!v.id && (
          <div className="mt-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-ink-soft">
                {t("fields.agentExpenses")}
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setV((s) => ({ ...s, costLines: [...s.costLines, emptyCostLine()] }))}
              >
                + {t("fields.addExpense")}
              </button>
            </div>
            {v.costLines.length === 0 ? (
              <p className="text-[12px] text-ink-soft">{t("fields.noExpenses")}</p>
            ) : (
              <div className="space-y-2">
                {v.costLines.map((line, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_auto]">
                    <select
                      aria-label={t("fields.expenseCategory")}
                      className={inputCls}
                      value={line.category}
                      onChange={(e) => setCostLine(i, { category: e.target.value })}
                    >
                      {FINANCE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{t(`financeCategory.${c}`)}</option>
                      ))}
                    </select>
                    <input
                      aria-label={t("fields.amount")}
                      className={inputCls}
                      placeholder="0.00"
                      value={line.amount}
                      onChange={(e) => setCostLine(i, { amount: e.target.value })}
                    />
                    <input
                      aria-label={t("fields.note")}
                      className={inputCls}
                      placeholder={t("fields.note")}
                      value={line.note}
                      onChange={(e) => setCostLine(i, { note: e.target.value })}
                    />
                    <button
                      type="button"
                      className="px-2 text-ink-soft hover:text-[rgb(var(--danger-fg))]"
                      aria-label={t("fields.remove")}
                      onClick={() => setV((s) => ({ ...s, costLines: s.costLines.filter((_, j) => j !== i) }))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <p className="text-right font-mono text-[11px] text-ink-soft">
                  {t("fields.total")}: {(costTotalCents / 100).toFixed(2)} {v.currency}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {!v.id && (
        <section className="mb-8">
          <SectionRule>{t("fields.documents")}</SectionRule>
          <FilePicker
            id="orderFiles"
            files={files}
            onChange={setFiles}
            addLabel={t("documents.addFiles")}
            emptyLabel={t("documents.noFilesSelected")}
            removeLabel={t("fields.remove")}
            errorLabels={{
              tooLarge: t("documents.tooLarge"),
              badType: t("documents.badType"),
              emptyFile: t("documents.emptyFile"),
            }}
            onReject={setUploadError}
          />
        </section>
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-0 mt-8 flex items-center justify-end gap-2 border-t border-edge-soft bg-surface/90 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        {(uploadError || (result && !result.ok && result.error)) && (
          <p className="mr-auto text-sm text-[rgb(var(--danger-fg))]">
            {uploadError ?? (result && !result.ok ? result.error : null)}
          </p>
        )}
        <a href={v.id ? `/orders/${v.id}` : "/orders"} className="btn-secondary">
          {t("actions.cancel")}
        </a>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t("actions.saving") : t("actions.save")}
        </button>
      </div>
    </form>
  );
}
