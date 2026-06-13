"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { ContactsEditor, type EditableContact } from "@/components/contacts-editor";
import { createCarrier, updateCarrier } from "./actions";
import type { ActionResult } from "@/lib/forms";

export type CarrierFormInitial = {
  id?: string;
  title: string;
  address: string;
  notes: string;
  contacts: EditableContact[];
};

export function CarrierForm({ initial }: { initial: CarrierFormInitial }) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes] = useState(initial.notes);
  const [contacts, setContacts] = useState<EditableContact[]>(initial.contacts);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = { title, address, notes, contacts };
    const r = initial.id ? await updateCarrier(initial.id, payload) : await createCarrier(payload);
    setPending(false);
    setResult(r);
    if (r.ok) {
      router.push(`/carriers/${r.id}`);
    }
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <Field label={t("fields.companyTitle")} htmlFor="title" error={fieldErrors.title}>
        <input id="title" required className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={t("fields.address")} htmlFor="address" error={fieldErrors.address}>
        <input id="address" className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label={t("fields.notes")} htmlFor="notes" error={fieldErrors.notes}>
        <textarea id="notes" rows={3} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Field label={t("fields.contacts")} error={fieldErrors.contacts}>
        <ContactsEditor contacts={contacts} onChange={setContacts} />
      </Field>
      {result && !result.ok && result.error && <p className="text-sm text-red-700">{result.error}</p>}
      <SubmitRow
        pending={pending}
        saveLabel={pending ? t("actions.saving") : t("actions.save")}
        cancelHref={initial.id ? `/carriers/${initial.id}` : "/carriers"}
        cancelLabel={t("actions.cancel")}
      />
    </form>
  );
}
