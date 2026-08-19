"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls } from "@/components/ui/form";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { FilePicker } from "@/components/ui/file-picker";
import { SectionRule } from "@/components/ui/record";
import { createOrder, updateOrder } from "./actions";
import { fetchContactOptions } from "@/modules/requests/actions";
import { uploadDocument } from "@/modules/documents/actions";
import { fetchAznRate } from "@/modules/fx/actions";
import { TRANSPORT_FAMILIES } from "@/lib/transport-matrix";
import { ORDER_CURRENCIES } from "@/lib/fx";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import { convertToAzn, formatMoneyAzn, toCents } from "@/lib/money";
import { INCOTERMS } from "@/lib/incoterms";
import { CargoEditor } from "@/modules/requests/cargo-editor";
import { LegEditor } from "@/modules/requests/leg-editor";
import { seedLegsForFamily } from "@/modules/requests/request-form-initial";
import { emptyCostLine, type OrderFormInitial } from "./order-form-initial";
import { nestedErrors, type ActionResult } from "@/lib/forms";

type Option = { id: string; title?: string };

const gridCls = "grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3";

export function OrderForm({
  initial,
  accountOpts,
  carrierOpts,
  staffOpts,
  contactOpts: initialContactOpts,
  cargoTypeOpts = [],
}: {
  initial: OrderFormInitial;
  accountOpts: Option[];
  carrierOpts: Option[];
  staffOpts: Option[];
  contactOpts: ComboOption[];
  cargoTypeOpts?: ComboOption[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [ex1Files, setEx1Files] = useState<File[]>([]);
  const [contactOpts, setContactOpts] = useState(initialContactOpts);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const set = (patch: Partial<OrderFormInitial>) => setV((s) => ({ ...s, ...patch }));

  /** Same rule as the request form (§5): contacts belong to the chosen client. */
  async function changeClient(accountId: string) {
    set({ accountId, contactId: "" });
    if (!accountId) {
      setContactOpts([]);
      return;
    }
    const opts = await fetchContactOptions(accountId);
    setContactOpts(opts);
    if (opts.length === 1) set({ contactId: opts[0].value });
  }

  const toOpts = (rows: Option[]): ComboOption[] =>
    rows.map((r) => ({ value: r.id, label: r.title ?? r.id }));

  /** Same seeding rule as the request form — one leg per mode, two for multimodal. */
  function changeFamily(next: string) {
    if (next === v.transportFamily) return;
    set({ transportFamily: next, legs: seedLegsForFamily(next, v.legs) });
  }

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

  /**
   * The EX1 cost as a cost line in the ORDER currency, so it rolls into the
   * carrier-cost total and margin like any other expense. A differing EX1
   * currency is converted via the CBAR cross-rate; the original amount stays in
   * the note. Returns an error key when a needed rate is unavailable.
   */
  async function ex1CostLine(): Promise<
    { line: OrderFormInitial["costLines"][number] | null } | { error: string }
  > {
    if (v.id || !v.ex1Required || v.ex1Cost.trim() === "") return { line: null };
    let amount = v.ex1Cost.trim();
    if (v.ex1Currency !== v.currency) {
      const today = new Date().toISOString().slice(0, 10);
      const ex1Azn =
        v.ex1Currency === "AZN" ? "1" : await fetchAznRate(v.ex1Currency, today);
      const orderAzn = v.currency === "AZN" ? "1" : v.exchangeRate;
      if (!ex1Azn || !orderAzn || !Number(orderAzn)) return { error: "rate" };
      amount = ((Number(amount) * Number(ex1Azn)) / Number(orderAzn)).toFixed(2);
    }
    return {
      line: {
        category: "ex1",
        amount,
        note: `EX1 ${v.ex1Cost.trim()} ${v.ex1Currency}`,
      },
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setUploadError(null);
    const ex1 = await ex1CostLine();
    if ("error" in ex1) {
      setPending(false);
      setResult({ ok: false, fieldErrors: { ex1Cost: [t("fields.ex1RateMissing")] } });
      return;
    }
    const payload = {
      accountId: v.accountId,
      contactId: v.contactId,
      responsibleUserId: v.responsibleUserId,
      carrierId: v.carrierId,
      title: v.title,
      ex1Required: v.ex1Required,
      transportFamily: v.transportFamily,
      legs: v.legs,
      cargo: v.cargo,
      incoterms: v.incoterms,
      currency: v.currency,
      exchangeRate: v.exchangeRate,
      clientCharge: v.clientCharge,
      costLines: [
        ...v.costLines.filter((l) => l.amount.trim() !== ""),
        ...(ex1.line ? [ex1.line] : []),
      ],
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
    for (const file of [...files, ...ex1Files]) {
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
  const nested = (prefix: string) => nestedErrors(fe, prefix);

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-[1400px] pb-24">
      {/* Who ordered → who runs it → what the order is; how it moves comes next. */}
      <section className="mb-8">
        <SectionRule>{t("orders.sectionConsignment")}</SectionRule>
        <div className={gridCls}>
          <Field label={t("fields.client")} htmlFor="accountId" error={fe.accountId}>
            <Combobox
              id="accountId"
              value={v.accountId}
              onChange={changeClient}
              options={toOpts(accountOpts)}
              placeholder={t("fields.selectAccount")}
              emptyLabel={t("common.noResults")}
            />
          </Field>
          <Field label={t("fields.contactPerson")} htmlFor="contactId" error={fe.contactId}>
            <Combobox
              id="contactId"
              value={v.contactId}
              onChange={(value) => set({ contactId: value })}
              options={contactOpts}
              placeholder={t("fields.selectContact")}
              emptyLabel={t("fields.noContacts")}
              disabled={!v.accountId}
            />
          </Field>
          <Field label={t("fields.responsibleManager")} htmlFor="responsibleUserId" error={fe.responsibleUserId}>
            <Combobox
              id="responsibleUserId"
              value={v.responsibleUserId}
              onChange={(value) => set({ responsibleUserId: value })}
              options={toOpts(staffOpts)}
              placeholder={t("fields.selectManager")}
            />
          </Field>
          <Field label={t("fields.orderTitle")} htmlFor="title" error={fe.title}>
            <input id="title" required className={inputCls} value={v.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          {v.number && (
            <Field label={t("fields.orderId")} htmlFor="orderNumber">
              <input id="orderNumber" className={inputCls} value={v.number} readOnly disabled />
            </Field>
          )}
        </div>
      </section>

      <section className="mb-8">
        <SectionRule>{t("requests.sectionRoute")}</SectionRule>
        <div className={gridCls}>
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
          <Field label={t("fields.transportType")} htmlFor="transportFamily" error={fe.transportFamily}>
            <Combobox
              id="transportFamily"
              value={v.transportFamily}
              onChange={changeFamily}
              options={TRANSPORT_FAMILIES.map((f) => ({ value: f, label: t(`transportFamily.${f}`) }))}
              placeholder={t("fields.selectTransportType")}
              emptyLabel={t("common.noResults")}
            />
          </Field>
        </div>
        <LegEditor
          family={v.transportFamily}
          legs={v.legs}
          cargo={v.cargo}
          onChange={(legs) => set({ legs })}
          errors={{ ...nested("legs"), ...(fe.legs ? { legs: fe.legs } : {}) }}
        />
      </section>

      <section className="mb-8">
        <SectionRule>{t("orders.sectionCargo")}</SectionRule>
        <CargoEditor
          cargo={v.cargo}
          onChange={(cargo) => set({ cargo })}
          errors={nested("cargo")}
          cargoTypeOpts={cargoTypeOpts}
          suggestTempControl={v.legs.some(
            (l) => l.vehicleType === "reefer" || l.containerType === "20rf" || l.containerType === "40rf",
          )}
        />
        <div className={`${gridCls} mt-4`}>
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

        {/* EX1 export declaration. The flag persists on the order; the cost
            becomes a cost line (category "ex1") on create, and afterwards is
            managed in the Finance tab like every other expense. */}
        <div className="mt-4">
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input
              type="checkbox"
              checked={v.ex1Required}
              onChange={(e) => set({ ex1Required: e.target.checked })}
            />
            {t("fields.ex1Required")}
          </label>
          {v.ex1Required && !v.id && (
            <div className={`${gridCls} mt-3`}>
              <Field label={t("fields.ex1Cost")} htmlFor="ex1Cost" error={fe.ex1Cost}>
                <input
                  id="ex1Cost"
                  className={inputCls}
                  placeholder="0.00"
                  value={v.ex1Cost}
                  onChange={(e) => set({ ex1Cost: e.target.value })}
                />
                {v.ex1Currency !== v.currency && v.ex1Cost.trim() !== "" && (
                  <p className="mt-1 text-[11px] text-ink-soft">{t("fields.ex1Converted", { currency: v.currency })}</p>
                )}
              </Field>
              <Field label={t("fields.currency")} htmlFor="ex1Currency">
                <select
                  id="ex1Currency"
                  className={inputCls}
                  value={v.ex1Currency}
                  onChange={(e) => set({ ex1Currency: e.target.value })}
                >
                  {ORDER_CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </Field>
              <Field label={t("fields.ex1Document")} htmlFor="ex1Files">
                <FilePicker
                  id="ex1Files"
                  files={ex1Files}
                  onChange={setEx1Files}
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
              </Field>
            </div>
          )}
          {v.ex1Required && v.id && (
            <p className="mt-1 text-[11.5px] text-ink-soft">{t("fields.ex1FinanceHint")}</p>
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
