"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { SectionRule } from "@/components/ui/record";
import { fromLocalInput } from "@/lib/datetime";
import { nestedErrors } from "@/lib/forms";
import { buildRequestTitle } from "@/lib/request-title";
import { LEAD_SOURCES, hasEmailSubject, hasSourceAgent, needsSourceNote } from "@/lib/lead-source";
import { TRANSPORT_FAMILIES } from "@/lib/transport-matrix";
import { INCOTERMS } from "@/lib/incoterms";
import { createAccount } from "@/modules/accounts/actions";
import { createRequest, fetchContactOptions, updateRequest } from "./actions";
import { CargoEditor } from "./cargo-editor";
import { LegEditor } from "./leg-editor";
import { seedLegsForFamily, type RequestFormInitial } from "./request-form-initial";
import type { ActionResult } from "./schema";

const gridCls = "grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3";

export function RequestForm({
  initial,
  accountOpts,
  agentOpts,
  staffOpts,
  contactOpts: initialContactOpts,
  cargoTypeOpts = [],
}: {
  initial: RequestFormInitial;
  accountOpts: ComboOption[];
  agentOpts: ComboOption[];
  staffOpts: ComboOption[];
  contactOpts: ComboOption[];
  cargoTypeOpts?: ComboOption[];
}) {
  const t = useTranslations("fields");
  const ta = useTranslations("actions");
  const tr = useTranslations("requests");
  const tls = useTranslations("leadSource");
  const tf = useTranslations("transportFamily");
  const ts = useTranslations("transportSubtype");
  const router = useRouter();

  const [v, setV] = useState(initial);
  /** Local copy so an inline-created client shows up without a round trip. */
  const [accounts, setAccounts] = useState(accountOpts);
  const [contactOpts, setContactOpts] = useState(initialContactOpts);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPending, setNewClientPending] = useState(false);
  const [newClientError, setNewClientError] = useState<string | null>(null);

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

  /**
   * Inline client creation (§5): only the name, everything else is filled in
   * later on the account page. Reuses the accounts module's action, so the
   * validation and audit trail are the same as the full form's.
   */
  async function addClient() {
    const title = newClientName.trim();
    if (!title || newClientPending) return;
    setNewClientPending(true);
    const r = await createAccount({ title, contacts: [] });
    setNewClientPending(false);
    if (!r.ok) {
      setNewClientError(r.fieldErrors?.title?.[0] ?? r.error ?? "error");
      return;
    }
    setAccounts((opts) => [...opts, { value: r.id, label: title }]);
    setNewClientOpen(false);
    setNewClientName("");
    setNewClientError(null);
    await changeClient(r.id);
  }

  const source = v.leadSource as (typeof LEAD_SOURCES)[number];

  function changeFamily(next: string) {
    if (next === v.transportFamily) return;
    set({ transportFamily: next, legs: seedLegsForFamily(next, v.legs) });
  }

  /**
   * The generated title (§6.2), rebuilt from the current values in the user's
   * own language. Once the user edits the title the generator stops overwriting
   * it — the field holds their words from then on.
   */
  const generatedTitle = useMemo(() => {
    const first = v.legs[0];
    const last = v.legs[v.legs.length - 1];
    const client = accounts.find((a) => a.value === v.accountId)?.label ?? null;
    const family = v.transportFamily;
    return buildRequestTitle({
      clientName: client,
      origin: first?.originCity || first?.originCountry || null,
      destination: last?.destinationCity || last?.destinationCountry || null,
      transport: family ? tf(family) : null,
      subtype: v.legs.length === 1 && first?.subtype ? ts(first.subtype) : null,
    });
  }, [v.accountId, v.legs, v.transportFamily, accounts, tf, ts]);

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
  const nested = (prefix: string) => nestedErrors(fe, prefix);

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
            options={accounts}
            placeholder={t("selectClient")}
          />
          {newClientOpen ? (
            <div className="mt-1.5 flex items-center gap-2">
              <input
                className={inputCls}
                placeholder={tr("newClientName")}
                value={newClientName}
                autoFocus
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addClient();
                  }
                }}
              />
              <button
                type="button"
                onClick={addClient}
                disabled={newClientPending}
                className="shrink-0 text-xs text-brand hover:underline disabled:opacity-40"
              >
                {newClientPending ? ta("saving") : ta("save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewClientOpen(false);
                  setNewClientError(null);
                }}
                className="shrink-0 text-xs text-ink-soft hover:underline"
              >
                {ta("cancel")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNewClientOpen(true)}
              className="mt-1 text-xs text-brand hover:underline"
            >
              + {tr("newClient")}
            </button>
          )}
          {newClientError && (
            <p className="mt-1 text-[11.5px] text-[rgb(var(--danger-fg))]">{newClientError}</p>
          )}
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
              options={
                // Keep a previously saved agent visible even if its role was removed.
                v.sourceAgentAccountId && !agentOpts.some((o) => o.value === v.sourceAgentAccountId)
                  ? [...agentOpts, ...accounts.filter((a) => a.value === v.sourceAgentAccountId)]
                  : agentOpts
              }
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
        cargo={v.cargo}
        onChange={(legs) => set({ legs })}
        errors={{ ...nested("legs"), ...(fe.legs ? { legs: fe.legs } : {}) }}
      />

      <SectionRule>{tr("sectionCargo")}</SectionRule>
      <CargoEditor
        cargo={v.cargo}
        onChange={(cargo) => set({ cargo })}
        errors={nested("cargo")}
        cargoTypeOpts={cargoTypeOpts}
        suggestTempControl={v.legs.some(
          (l) => l.vehicleType === "reefer" || l.containerType === "20rf" || l.containerType === "40rf",
        )}
      />

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
