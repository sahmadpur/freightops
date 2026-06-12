"use client";

import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";

export type EditableContact = { name: string; phones: string[]; emails: string[] };

export function emptyContact(): EditableContact {
  return { name: "", phones: [""], emails: [""] };
}

export function ContactsEditor({
  contacts,
  onChange,
}: {
  contacts: EditableContact[];
  onChange: (next: EditableContact[]) => void;
}) {
  const t = useTranslations("fields");

  const update = (i: number, patch: Partial<EditableContact>) =>
    onChange(contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const updateList = (i: number, key: "phones" | "emails", j: number, value: string) =>
    update(i, { [key]: contacts[i][key].map((v, idx) => (idx === j ? value : v)) } as Partial<EditableContact>);

  const addToList = (i: number, key: "phones" | "emails") =>
    update(i, { [key]: [...contacts[i][key], ""] } as Partial<EditableContact>);

  return (
    <div className="space-y-3">
      {/* Index keys are fine here: rows are only user-edited, inputs are controlled,
          and state lives in the parent form. Not suitable for sorted/filtered lists. */}
      {contacts.map((c, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {t("contacts")} {i + 1}
            </span>
            <button
              type="button"
              onClick={() => onChange(contacts.filter((_, idx) => idx !== i))}
              className="text-xs text-red-700 hover:underline"
            >
              {t("remove")}
            </button>
          </div>
          <input
            className={inputCls}
            placeholder={t("contactName")}
            value={c.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-xs text-slate-500">{t("phones")}</div>
              {c.phones.map((p, j) => (
                <input
                  key={j}
                  className={`${inputCls} mb-1.5`}
                  value={p}
                  onChange={(e) => updateList(i, "phones", j, e.target.value)}
                />
              ))}
              <button type="button" onClick={() => addToList(i, "phones")} className="text-xs text-[#1a3a5c] hover:underline">
                + {t("addPhone")}
              </button>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-500">{t("emails")}</div>
              {c.emails.map((m, j) => (
                <input
                  key={j}
                  type="email"
                  className={`${inputCls} mb-1.5`}
                  value={m}
                  onChange={(e) => updateList(i, "emails", j, e.target.value)}
                />
              ))}
              <button type="button" onClick={() => addToList(i, "emails")} className="text-xs text-[#1a3a5c] hover:underline">
                + {t("addEmail")}
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...contacts, emptyContact()])}
        className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
      >
        + {t("addContact")}
      </button>
    </div>
  );
}
