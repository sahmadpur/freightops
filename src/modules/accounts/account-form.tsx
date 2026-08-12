"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/card";
import { Combobox, MultiCombobox } from "@/components/ui/combobox";
import { ContactsEditor, type EditableContact } from "@/components/contacts-editor";
import { COMPANY_ROLES } from "@/lib/company-roles";
import { countryOptions } from "@/lib/countries";
import { createAccount, updateAccount } from "./actions";
import type { ActionResult } from "./schema";

export type AccountFormInitial = {
  id?: string;
  title: string;
  roles: string[];
  taxId: string;
  address: string;
  country: string;
  city: string;
  phones: string[];
  emailDomains: string[];
  notes: string;
  contacts: EditableContact[];
};

export function AccountForm({ initial }: { initial: AccountFormInitial }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [roles, setRoles] = useState<string[]>(initial.roles);
  const [taxId, setTaxId] = useState(initial.taxId);
  const [address, setAddress] = useState(initial.address);
  const [country, setCountry] = useState(initial.country);
  const [city, setCity] = useState(initial.city);
  const [phones, setPhones] = useState<string[]>(initial.phones);
  const [emailDomains, setEmailDomains] = useState<string[]>(initial.emailDomains);
  const [notes, setNotes] = useState(initial.notes);
  const [contacts, setContacts] = useState<EditableContact[]>(initial.contacts);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const countries = useMemo(() => countryOptions(locale), [locale]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = { title, roles, taxId, address, country, city, phones, emailDomains, notes, contacts };
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
      <Card>
        <CardBody>
      <Field label={t("fields.companyTitle")} htmlFor="title" error={fieldErrors.title}>
        <input id="title" required className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={t("fields.roles")} error={fieldErrors.roles}>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 py-1">
          {COMPANY_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={(e) =>
                  setRoles(e.target.checked ? [...roles, role] : roles.filter((r) => r !== role))
                }
              />
              {t(`companyRoles.${role}`)}
            </label>
          ))}
        </div>
      </Field>
      <Field label={t("fields.taxId")} htmlFor="taxId" error={fieldErrors.taxId}>
        <input id="taxId" className={inputCls} value={taxId} onChange={(e) => setTaxId(e.target.value)} />
      </Field>
      <Field label={t("fields.address")} htmlFor="address" error={fieldErrors.address}>
        <input id="address" className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        <Field label={t("fields.country")} htmlFor="country" error={fieldErrors.country}>
          <Combobox id="country" value={country} onChange={setCountry} options={countries} />
        </Field>
        <Field label={t("fields.city")} htmlFor="city" error={fieldErrors.city}>
          <input id="city" className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </div>
      <Field label={t("fields.phones")} htmlFor="phones" error={fieldErrors.phones}>
        <MultiCombobox id="phones" values={phones} onChange={setPhones} options={[]} creatable />
      </Field>
      {/* Domains are the fallback key for matching an inbound email's sender to this company. */}
      <Field label={t("fields.emailDomains")} htmlFor="emailDomains" error={fieldErrors.emailDomains}>
        <MultiCombobox
          id="emailDomains"
          values={emailDomains}
          onChange={setEmailDomains}
          options={[]}
          creatable
          placeholder={t("fields.emailDomainsHint")}
        />
      </Field>
      <Field label={t("fields.notes")} htmlFor="notes" error={fieldErrors.notes}>
        <textarea id="notes" rows={3} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Field label={t("fields.contacts")} error={fieldErrors.contacts}>
        <ContactsEditor contacts={contacts} onChange={setContacts} />
      </Field>
      {result && !result.ok && result.error && (
        <p className="text-sm text-[rgb(var(--danger-fg))]">{result.error}</p>
      )}
      <SubmitRow
        pending={pending}
        saveLabel={pending ? t("actions.saving") : t("actions.save")}
        cancelHref={initial.id ? `/accounts/${initial.id}` : "/accounts"}
        cancelLabel={t("actions.cancel")}
      />
        </CardBody>
      </Card>
    </form>
  );
}
