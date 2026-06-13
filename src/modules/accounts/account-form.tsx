"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { ContactsEditor, type EditableContact } from "@/components/contacts-editor";
import { createAccount, updateAccount } from "./actions";
import type { ActionResult } from "./schema";

export type AccountFormInitial = {
  id?: string;
  title: string;
  taxId: string;
  address: string;
  notes: string;
  contacts: EditableContact[];
};

export function AccountForm({ initial }: { initial: AccountFormInitial }) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [taxId, setTaxId] = useState(initial.taxId);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes] = useState(initial.notes);
  const [contacts, setContacts] = useState<EditableContact[]>(initial.contacts);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = { title, taxId, address, notes, contacts };
    const r = initial.id ? await updateAccount(initial.id, payload) : await createAccount(payload);
    setPending(false);
    setResult(r);
    if (r.ok) {
      router.push(`/accounts/${r.id}`);
    }
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <Field label={t("fields.companyTitle")} htmlFor="title" error={fieldErrors.title}>
        <input id="title" required className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={t("fields.taxId")} htmlFor="taxId" error={fieldErrors.taxId}>
        <input id="taxId" className={inputCls} value={taxId} onChange={(e) => setTaxId(e.target.value)} />
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
        cancelHref={initial.id ? `/accounts/${initial.id}` : "/accounts"}
        cancelLabel={t("actions.cancel")}
      />
    </form>
  );
}
