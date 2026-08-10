"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { SectionRule } from "@/components/ui/record";
import { fromLocalInput } from "@/lib/datetime";
import { buildRequestTitle } from "@/lib/request-title";
import { LEAD_SOURCES, hasEmailSubject, hasSourceAgent, needsSourceNote } from "@/lib/lead-source";
import {
  TRANSPORT_FAMILIES,
  isLegTransportType,
  type LegTransportType,
} from "@/lib/transport-matrix";
import { INCOTERMS } from "@/lib/incoterms";
import { createRequest, fetchContactOptions, updateRequest } from "./actions";
import { CargoEditor } from "./cargo-editor";
import { LegEditor } from "./leg-editor";
import { emptyLeg, type LegDraft, type RequestFormInitial } from "./request-form-initial";
import type { ActionResult } from "./schema";

const gridCls = "grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3";

export function RequestForm({
  initial,
  accountOpts,
  staffOpts,
  contactOpts: initialContactOpts,
}: {
  initial: RequestFormInitial;
  accountOpts: ComboOption[];
  staffOpts: ComboOption[];
  contactOpts: ComboOption[];
}) {
  const t = useTranslations("fields");
  const ta = useTranslations("actions");
  const tr = useTranslations("requests");
  const tls = useTranslations("leadSource");
  const tf = useTranslations("transportFamily");
  const ts = useTranslations("transportSubtype");
  const router = useRouter();

  const [v, setV] = useState(initial);
  const [contactOpts, setContactOpts] = useState(initialContactOpts);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const set = (patch: Partial<RequestFormInitial>) => setV((s) => ({ ...s, ...patch }));

  /**
   * The contact list belongs to the chosen client (§5), so it is reloaded when
   * the client changes — in the handler rather than an effect, since this is a
   * response to a user action and not a subscription to external state. A
   * company with exactly one contact has it selected outright.
   */
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

  const source = v.leadSource as (typeof LEAD_SOURCES)[number];

  /**
   * Choosing the transport type seeds the legs: one for a single-mode shipment,
   * two to start with for multimodal. Switching between single modes rewrites
   * the one leg's type rather than adding another.
   */
  function changeFamily(next: string) {
    if (next === v.transportFamily) return;
    let legs: LegDraft[] = v.legs;
    if (next === "multimodal") {
      legs = v.legs.length >= 2 ? v.legs : [...v.legs, emptyLeg()].slice(0, 2);
      if (legs.length < 2) legs = [emptyLeg(), emptyLeg()];
    } else if (isLegTransportType(next)) {
      const type = next as LegTransportType;
      const first = v.legs[0];
      legs = [
        first
          ? { ...emptyLeg(type), originCountry: first.originCountry, originCity: first.originCity, destinationCountry: first.destinationCountry, destinationCity: first.destinationCity }
          : emptyLeg(type),
      ];
    } else {
      legs = [];
    }
    set({ transportFamily: next, legs });
  }

  /**
   * The generated title (§6.2), rebuilt from the current values in the user's
   * own language. Once the user edits the title the generator stops overwriting
   * it — the field holds their words from then on.
   */
  const generatedTitle = useMemo(() => {
    const first = v.legs[0];
    const last = v.legs[v.legs.length - 1];
    const client = accountOpts.find((a) => a.value === v.accountId)?.label ?? null;
    const family = v.transportFamily;
    return buildRequestTitle({
      clientName: client,
      origin: first?.originCity || first?.originCountry || null,
      destination: last?.destinationCity || last?.destinationCountry || null,
      transport: family ? tf(family) : null,
      subtype: v.legs.length === 1 && first?.subtype ? ts(first.subtype) : null,
    });
  }, [v.accountId, v.legs, v.transportFamily, accountOpts, tf, ts]);

  const [titleTouched, setTitleTouched] = useState(Boolean(initial.title));
  const title = titleTouched ? v.title : generatedTitle;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = {
      accountId: v.accountId,
      contactId: v.contactId,
      responsibleUserId: v.responsibleUserId,
      leadSource: v.leadSource,
      sourceAgentAccountId: hasSourceAgent(source) ? v.sourceAgentAccountId : "",
      sourceNote: v.sourceNote,
      emailSubject: hasEmailSubject(source) ? v.emailSubject : "",
      title,
      receivedAt: fromLocalInput(v.receivedAt),
      transportFamily: v.transportFamily,
      incoterms: v.incoterms,
      incotermPlace: v.incotermPlace,
      cargoReadyDate: v.cargoReadyDate,
      requestedDeliveryDate: v.requestedDeliveryDate,
      specialInstructions: v.specialInstructions,
      legs: v.legs,
      cargo: v.cargo,
    };
    const r = v.id ? await updateRequest(v.id, payload) : await createRequest(payload);
    setPending(false);
    setResult(r);
    if (r.ok) router.push(`/requests/${r.id}`);
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  /** Nested zod paths arrive flattened as `legs.0.subtype`; the editors slice them apart. */
  const nested = (prefix: string): Record<string, string[]> =>
    Object.fromEntries(
      Object.entries(fe)
        .filter(([k]) => k.startsWith(`${prefix}.`))
        .map(([k, val]) => [k.slice(prefix.length + 1), val]),
    );

  const opt = (values: readonly string[], label: (v: string) => string): ComboOption[] =>
    values.map((value) => ({ value, label: label(value) }));

  return (
    <form onSubmit={onSubmit} className="max-w-5xl">
      <SectionRule>{tr("sectionEnquiry")}</SectionRule>
      <div className={gridCls}>
        <Field label={t("client")} htmlFor="accountId" error={fe.accountId}>
          <Combobox
            id="accountId"
            value={v.accountId}
            onChange={changeClient}
            options={accountOpts}
            placeholder={t("selectClient")}
          />
        </Field>
        <Field label={t("contactPerson")} htmlFor="contactId" error={fe.contactId}>
          <Combobox
            id="contactId"
            value={v.contactId}
            onChange={(value) => set({ contactId: value })}
            options={contactOpts}
            placeholder={t("selectContact")}
            emptyLabel={t("noContacts")}
            disabled={!v.accountId}
          />
        </Field>
        <Field label={t("responsibleManager")} htmlFor="responsibleUserId" error={fe.responsibleUserId}>
          <Combobox
            id="responsibleUserId"
            value={v.responsibleUserId}
            onChange={(value) => set({ responsibleUserId: value })}
            options={staffOpts}
            placeholder={t("selectManager")}
            clearable={false}
          />
        </Field>
        <Field label={t("leadSource")} htmlFor="leadSource" error={fe.leadSource}>
          <Combobox
            id="leadSource"
            value={v.leadSource}
            onChange={(value) => set({ leadSource: value })}
            options={opt(LEAD_SOURCES, (s) => tls(s))}
            clearable={false}
          />
        </Field>
        {/* Distinct from created_at on purpose: the gap between them is the
            registration-time KPI (§22). */}
        <Field label={t("receivedAt")} htmlFor="receivedAt" error={fe.receivedAt}>
          <input
            id="receivedAt"
            type="datetime-local"
            required
            className={inputCls}
            value={v.receivedAt}
            onChange={(e) => set({ receivedAt: e.target.value })}
          />
        </Field>
        {hasSourceAgent(source) && (
          <Field label={t("sourceAgent")} htmlFor="sourceAgentAccountId" error={fe.sourceAgentAccountId}>
            <Combobox
              id="sourceAgentAccountId"
              value={v.sourceAgentAccountId}
              onChange={(value) => set({ sourceAgentAccountId: value })}
              options={accountOpts}
            />
          </Field>
        )}
      </div>

      {hasEmailSubject(source) && (
        <Field label={t("emailSubject")} htmlFor="emailSubject" error={fe.emailSubject}>
          <input
            id="emailSubject"
            className={inputCls}
            value={v.emailSubject}
            onChange={(e) => set({ emailSubject: e.target.value })}
          />
        </Field>
      )}
      {needsSourceNote(source) && (
        <Field label={t("sourceNote")} htmlFor="sourceNote" error={fe.sourceNote}>
          <textarea
            id="sourceNote"
            rows={3}
            className={inputCls}
            value={v.sourceNote}
            onChange={(e) => set({ sourceNote: e.target.value })}
          />
        </Field>
      )}
      <Field label={t("requestTitle")} htmlFor="title" error={fe.title}>
        <input
          id="title"
          className={inputCls}
          value={title}
          placeholder={t("titleAuto")}
          onChange={(e) => {
            setTitleTouched(true);
            set({ title: e.target.value });
          }}
        />
      </Field>

      <SectionRule>{tr("sectionRoute")}</SectionRule>
      <div className={gridCls}>
        <Field label={t("transportType")} htmlFor="transportFamily" error={fe.transportFamily}>
          <Combobox
            id="transportFamily"
            value={v.transportFamily}
            onChange={changeFamily}
            options={opt(TRANSPORT_FAMILIES, (f) => tf(f))}
            placeholder={t("selectTransportType")}
          />
        </Field>
      </div>
      <LegEditor
        family={v.transportFamily}
        legs={v.legs}
        onChange={(legs) => set({ legs })}
        errors={{ ...nested("legs"), ...(fe.legs ? { legs: fe.legs } : {}) }}
      />

      <SectionRule>{tr("sectionCargo")}</SectionRule>
      <CargoEditor cargo={v.cargo} onChange={(cargo) => set({ cargo })} errors={nested("cargo")} />

      <SectionRule>{tr("sectionTerms")}</SectionRule>
      <div className={gridCls}>
        <Field label={t("incoterms")} htmlFor="incoterms" error={fe.incoterms}>
          <Combobox
            id="incoterms"
            value={v.incoterms}
            onChange={(value) => set({ incoterms: value })}
            options={INCOTERMS.map((i) => ({ value: i, label: i }))}
          />
        </Field>
        {/* Only meaningful once a term is chosen — "EXW Hamburg", never a bare place. */}
        {v.incoterms && (
          <Field label={t("incotermPlace")} htmlFor="incotermPlace" error={fe.incotermPlace}>
            <input
              id="incotermPlace"
              className={inputCls}
              value={v.incotermPlace}
              onChange={(e) => set({ incotermPlace: e.target.value })}
            />
          </Field>
        )}
        <Field label={t("cargoReadyDate")} htmlFor="cargoReadyDate" error={fe.cargoReadyDate}>
          <input
            id="cargoReadyDate"
            type="date"
            className={inputCls}
            value={v.cargoReadyDate}
            onChange={(e) => set({ cargoReadyDate: e.target.value })}
          />
        </Field>
        <Field label={t("requestedDeliveryDate")} htmlFor="requestedDeliveryDate" error={fe.requestedDeliveryDate}>
          <input
            id="requestedDeliveryDate"
            type="date"
            className={inputCls}
            value={v.requestedDeliveryDate}
            onChange={(e) => set({ requestedDeliveryDate: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t("specialInstructions")} htmlFor="specialInstructions" error={fe.specialInstructions}>
        <textarea
          id="specialInstructions"
          rows={3}
          className={inputCls}
          value={v.specialInstructions}
          onChange={(e) => set({ specialInstructions: e.target.value })}
        />
      </Field>

      {result && !result.ok && result.error && (
        <p className="text-sm text-[rgb(var(--danger-fg))]">
          {result.error === "not_allowed" ? tr("notAllowed") : result.error}
        </p>
      )}
      <SubmitRow
        pending={pending}
        saveLabel={pending ? ta("saving") : v.id ? ta("save") : tr("saveDraft")}
        cancelHref={v.id ? `/requests/${v.id}` : "/requests"}
        cancelLabel={ta("cancel")}
      />
    </form>
  );
}
