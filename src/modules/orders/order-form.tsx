"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { createOrder, updateOrder } from "./actions";
import type { ActionResult } from "@/lib/forms";
import type { OrderFormInitial } from "./order-form-initial";

const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
const DELIVERY_FORMATS = ["FCL", "LCL", "FTL", "LTL"] as const;
const MODE_TYPES = ["vehicle", "air", "postal", "rail", "sea"] as const;

type Option = { id: string; title?: string; number?: string; modeType?: string };

export function OrderForm({
  initial,
  accountOpts,
  carrierOpts,
  transportOpts,
}: {
  initial: OrderFormInitial;
  accountOpts: Option[];
  carrierOpts: Option[];
  transportOpts: Option[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const set = (patch: Partial<OrderFormInitial>) => setV((s) => ({ ...s, ...patch }));
  const setNew = (patch: Partial<OrderFormInitial["newTransport"]>) =>
    setV((s) => ({ ...s, newTransport: { ...s.newTransport, ...patch } }));

  function buildTransport() {
    if (v.transportMode === "none") return { mode: "none" as const };
    if (v.transportMode === "existing") return { mode: "existing" as const, transportModeId: v.transportModeId };
    return { mode: "new" as const, ...v.newTransport };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = {
      title: v.title,
      clientOrderId: v.clientOrderId,
      accountId: v.accountId,
      carrierId: v.carrierId,
      route: v.route,
      cargoDescription: v.cargoDescription,
      packages: v.packages,
      weightKg: v.weightKg,
      volumeM3: v.volumeM3,
      incoterms: v.incoterms,
      deliveryFormat: v.deliveryFormat,
      clientCharge: v.clientCharge,
      carrierCost: v.carrierCost,
      additionalCosts: v.additionalCosts,
      additionalCostsNote: v.additionalCostsNote,
      expectedProfit: v.expectedProfit,
      invoiceNumber: v.invoiceNumber,
      invoiceDate: v.invoiceDate,
      transport: buildTransport(),
    };
    const r = v.id ? await updateOrder(v.id, payload) : await createOrder(payload);
    setPending(false);
    setResult(r);
    if (r.ok) router.push(`/orders/${r.id}`);
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const sectionCls = "mt-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";

  return (
    <form onSubmit={onSubmit} className="max-w-3xl">
      <div className={sectionCls}>{t("orders.title")}</div>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t("fields.orderTitle")} htmlFor="title" error={fe.title}>
          <input id="title" required className={inputCls} value={v.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label={t("fields.clientOrderId")} htmlFor="clientOrderId" error={fe.clientOrderId}>
          <input id="clientOrderId" className={inputCls} value={v.clientOrderId} onChange={(e) => set({ clientOrderId: e.target.value })} />
        </Field>
        <Field label={t("fields.client")} htmlFor="accountId" error={fe.accountId}>
          <select id="accountId" required className={inputCls} value={v.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            <option value="">{t("fields.selectAccount")}</option>
            {accountOpts.map((o) => (<option key={o.id} value={o.id}>{o.title}</option>))}
          </select>
        </Field>
        <Field label={t("fields.carrier")} htmlFor="carrierId" error={fe.carrierId}>
          <select id="carrierId" className={inputCls} value={v.carrierId} onChange={(e) => set({ carrierId: e.target.value })}>
            <option value="">{t("fields.selectCarrier")}</option>
            {carrierOpts.map((o) => (<option key={o.id} value={o.id}>{o.title}</option>))}
          </select>
        </Field>
        <Field label={t("fields.route")} htmlFor="route" error={fe.route}>
          <input id="route" className={inputCls} value={v.route} onChange={(e) => set({ route: e.target.value })} />
        </Field>
        <div />
      </div>

      <div className={sectionCls}>{t("fields.cargoDescription")}</div>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t("fields.cargoDescription")} htmlFor="cargo" error={fe.cargoDescription}>
          <input id="cargo" className={inputCls} value={v.cargoDescription} onChange={(e) => set({ cargoDescription: e.target.value })} />
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
        <Field label={t("fields.deliveryFormat")} htmlFor="deliveryFormat" error={fe.deliveryFormat}>
          <select id="deliveryFormat" className={inputCls} value={v.deliveryFormat} onChange={(e) => set({ deliveryFormat: e.target.value })}>
            <option value="">—</option>
            {DELIVERY_FORMATS.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </Field>
      </div>

      <div className={sectionCls}>{t("nav.finance")}</div>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t("fields.clientCharge")} htmlFor="clientCharge" error={fe.clientCharge}>
          <input id="clientCharge" className={inputCls} value={v.clientCharge} onChange={(e) => set({ clientCharge: e.target.value })} />
        </Field>
        <Field label={t("fields.carrierCost")} htmlFor="carrierCost" error={fe.carrierCost}>
          <input id="carrierCost" className={inputCls} value={v.carrierCost} onChange={(e) => set({ carrierCost: e.target.value })} />
        </Field>
        <Field label={t("fields.additionalCosts")} htmlFor="additionalCosts" error={fe.additionalCosts}>
          <input id="additionalCosts" className={inputCls} value={v.additionalCosts} onChange={(e) => set({ additionalCosts: e.target.value })} />
        </Field>
        <Field label={t("fields.expectedProfit")} htmlFor="expectedProfit" error={fe.expectedProfit}>
          <input id="expectedProfit" className={inputCls} value={v.expectedProfit} onChange={(e) => set({ expectedProfit: e.target.value })} />
        </Field>
        <Field label={t("fields.invoiceNumber")} htmlFor="invoiceNumber" error={fe.invoiceNumber}>
          <input id="invoiceNumber" className={inputCls} value={v.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} />
        </Field>
        <Field label={t("fields.invoiceDate")} htmlFor="invoiceDate" error={fe.invoiceDate}>
          <input id="invoiceDate" type="date" className={inputCls} value={v.invoiceDate} onChange={(e) => set({ invoiceDate: e.target.value })} />
        </Field>
      </div>

      <div className={sectionCls}>{t("fields.transport")}</div>
      <div className="mb-3 flex gap-4 text-sm">
        {(["none", "existing", "new"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5">
            <input type="radio" name="transportMode" checked={v.transportMode === m} onChange={() => set({ transportMode: m })} />
            {m === "none" ? t("fields.noTransport") : m === "existing" ? t("fields.attachExisting") : t("fields.createNew")}
          </label>
        ))}
      </div>
      {v.transportMode === "existing" && (
        <Field label={t("fields.transportMode")} htmlFor="transportModeId" error={fe.transport}>
          <select id="transportModeId" className={inputCls} value={v.transportModeId} onChange={(e) => set({ transportModeId: e.target.value })}>
            <option value="">{t("fields.selectTransport")}</option>
            {transportOpts.map((o) => (<option key={o.id} value={o.id}>{o.number} ({o.modeType})</option>))}
          </select>
        </Field>
      )}
      {v.transportMode === "new" && (
        <div className="grid grid-cols-2 gap-x-4 rounded-lg border border-dashed border-slate-300 p-3">
          <Field label={t("fields.modeType")} htmlFor="ntModeType">
            <select id="ntModeType" className={inputCls} value={v.newTransport.modeType} onChange={(e) => setNew({ modeType: e.target.value })}>
              {MODE_TYPES.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </Field>
          <Field label={t("fields.transportNumber")} htmlFor="ntNumber">
            <input id="ntNumber" className={inputCls} value={v.newTransport.number} onChange={(e) => setNew({ number: e.target.value })} />
          </Field>
          <Field label={t("fields.fromCountry")} htmlFor="ntFrom">
            <input id="ntFrom" className={inputCls} value={v.newTransport.fromCountry} onChange={(e) => setNew({ fromCountry: e.target.value })} />
          </Field>
          <Field label={t("fields.toCountry")} htmlFor="ntTo">
            <input id="ntTo" className={inputCls} value={v.newTransport.toCountry} onChange={(e) => setNew({ toCountry: e.target.value })} />
          </Field>
          <Field label={t("fields.loadingDate")} htmlFor="ntLoad">
            <input id="ntLoad" type="date" className={inputCls} value={v.newTransport.loadingDate} onChange={(e) => setNew({ loadingDate: e.target.value })} />
          </Field>
          <Field label={t("fields.plannedArrivalDate")} htmlFor="ntArr">
            <input id="ntArr" type="date" className={inputCls} value={v.newTransport.plannedArrivalDate} onChange={(e) => setNew({ plannedArrivalDate: e.target.value })} />
          </Field>
        </div>
      )}

      {result && !result.ok && result.error && <p className="mt-3 text-sm text-red-700">{result.error}</p>}
      <SubmitRow
        pending={pending}
        saveLabel={pending ? t("actions.saving") : t("actions.save")}
        cancelHref={v.id ? `/orders/${v.id}` : "/orders"}
        cancelLabel={t("actions.cancel")}
      />
    </form>
  );
}
