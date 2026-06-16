"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DocumentRow as DocRow } from "./queries";
import { deleteDocument, setDocumentVisibility } from "./actions";

export function DocumentRow({ doc }: { doc: DocRow }) {
  const t = useTranslations("documents");
  const td = useTranslations("docType");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleVisibility() {
    setBusy(true);
    try {
      const r = await setDocumentVisibility(doc.id, { visibleToClient: !doc.visibleToClient });
      if (r.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const r = await deleteDocument(doc.id);
      if (r.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <span className="flex-1 truncate">
        <span className="font-medium">{doc.fileName}</span>
        <span className="ml-2 text-xs text-slate-400">{td(doc.docType)}</span>
      </span>
      <button
        type="button"
        onClick={toggleVisibility}
        disabled={busy}
        className={`rounded-full px-2 py-0.5 text-[10.5px] ${doc.visibleToClient ? "bg-[rgb(var(--approval-approved-bg))] text-[rgb(var(--approval-approved-fg))]" : "bg-surface-chip-active text-ink-soft"} disabled:opacity-50`}
      >
        {doc.visibleToClient ? t("clientVisible") : t("internal")}
      </button>
      <a href={`/api/documents/${doc.id}/download`} className="text-xs text-indigo-600 hover:underline">
        {t("download")}
      </a>
      <button type="button" onClick={remove} disabled={busy} className="text-xs text-red-700 hover:underline disabled:opacity-50">
        {t("remove")}
      </button>
    </li>
  );
}
