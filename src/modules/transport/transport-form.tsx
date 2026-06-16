"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/card";
import { createTransportMode, updateTransportMode } from "./actions";
import type { ActionResult } from "@/lib/forms";

const MODE_TYPES = ["vehicle", "air", "postal", "rail", "sea"] as const;

export type TransportFormInitial = {
  id?: string;
  modeType: string;
  number: string;
  fromCountry: string;
  toCountry: string;
  route: string;
  loadingDate: string;
  plannedArrivalDate: string;
  totalWeightKg: string;
  totalVolumeM3: string;
};

export function TransportForm({ initial }: { initial: TransportFormInitial }) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const set = (patch: Partial<TransportFormInitial>) => setV((s) => ({ ...s, ...patch }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { id, ...payload } = v;
    const r = id ? await updateTransportMode(id, payload) : await createTransportMode(payload);
    setPending(false);
    setResult(r);
    if (r.ok) router.push(`/transportation/${r.id}`);
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <Card>
        <CardBody>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t("fields.modeType")} htmlFor="modeType" error={fe.modeType}>
          <select id="modeType" className={inputCls} value={v.modeType} onChange={(e) => set({ modeType: e.target.value })}>
            {MODE_TYPES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label={t("fields.transportNumber")} htmlFor="number" error={fe.number}>
          <input id="number" required className={inputCls} value={v.number} onChange={(e) => set({ number: e.target.value })} />
        </Field>
        <Field label={t("fields.fromCountry")} htmlFor="fromCountry" error={fe.fromCountry}>
          <input id="fromCountry" className={inputCls} value={v.fromCountry} onChange={(e) => set({ fromCountry: e.target.value })} />
        </Field>
        <Field label={t("fields.toCountry")} htmlFor="toCountry" error={fe.toCountry}>
          <input id="toCountry" className={inputCls} value={v.toCountry} onChange={(e) => set({ toCountry: e.target.value })} />
        </Field>
        <Field label={t("fields.route")} htmlFor="route" error={fe.route}>
          <input id="route" className={inputCls} value={v.route} onChange={(e) => set({ route: e.target.value })} />
        </Field>
        <div />
        <Field label={t("fields.loadingDate")} htmlFor="loadingDate" error={fe.loadingDate}>
          <input id="loadingDate" type="date" className={inputCls} value={v.loadingDate} onChange={(e) => set({ loadingDate: e.target.value })} />
        </Field>
        <Field label={t("fields.plannedArrivalDate")} htmlFor="plannedArrivalDate" error={fe.plannedArrivalDate}>
          <input id="plannedArrivalDate" type="date" className={inputCls} value={v.plannedArrivalDate} onChange={(e) => set({ plannedArrivalDate: e.target.value })} />
        </Field>
        <Field label={t("fields.totalWeightKg")} htmlFor="totalWeightKg" error={fe.totalWeightKg}>
          <input id="totalWeightKg" className={inputCls} value={v.totalWeightKg} onChange={(e) => set({ totalWeightKg: e.target.value })} />
        </Field>
        <Field label={t("fields.totalVolumeM3")} htmlFor="totalVolumeM3" error={fe.totalVolumeM3}>
          <input id="totalVolumeM3" className={inputCls} value={v.totalVolumeM3} onChange={(e) => set({ totalVolumeM3: e.target.value })} />
        </Field>
      </div>
      {result && !result.ok && result.error && (
        <p className="text-sm text-[rgb(var(--danger-fg))]">{result.error}</p>
      )}
      <SubmitRow
        pending={pending}
        saveLabel={pending ? t("actions.saving") : t("actions.save")}
        cancelHref={initial.id ? `/transportation/${initial.id}` : "/transportation"}
        cancelLabel={t("actions.cancel")}
      />
        </CardBody>
      </Card>
    </form>
  );
}
