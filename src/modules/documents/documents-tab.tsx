"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { inputCls } from "@/components/ui/form";
import type { DocumentRow as DocRow } from "./queries";
import { uploadDocument } from "./actions";
import { DocumentRow } from "./document-row";

const DOC_TYPES = ["cmr", "awb", "bill_of_lading", "invoice", "packing_list", "certificate", "waybill", "cargo_photos", "other"] as const;

export function DocumentsTab({ orderId, documents }: { orderId: string; documents: DocRow[] }) {
  const t = useTranslations("documents");
  const td = useTranslations("docType");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>("other");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("parentType", "order");
    fd.set("parentId", orderId);
    fd.set("docType", docType);
    fd.set("visibleToClient", visible ? "true" : "false");
    const r = await uploadDocument(fd);
    setPending(false);
    if (r.ok) {
      if (fileRef.current) fileRef.current.value = "";
      setVisible(false);
      setDocType("other");
      router.refresh();
    } else {
      const reason = r.error;
      setError(
        reason === "too_large" ? t("tooLarge") :
        reason === "type" ? t("badType") :
        reason === "empty" ? t("emptyFile") : t("uploadFailed"),
      );
    }
  }

  return (
    <Card>
      <CardHeader><span className="text-sm font-semibold">{t("tab")}</span></CardHeader>
      <CardBody>
        {documents.length === 0 ? (
          <p className="mb-4 text-sm text-slate-400">{t("noDocuments")}</p>
        ) : (
          <ul className="mb-4 space-y-1.5">
            {documents.map((d) => (
              <DocumentRow key={d.id} doc={d} />
            ))}
          </ul>
        )}

        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="file">{t("fileLabel")}</label>
            <input id="file" ref={fileRef} type="file" required className="text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="docType">{t("typeLabel")}</label>
            <select id="docType" className={`${inputCls} w-44`} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((d) => (<option key={d} value={d}>{td(d)}</option>))}
            </select>
          </div>
          <label className="mb-2 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            {t("visibleToClient")}
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mb-1 rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? t("uploading") : t("upload")}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </CardBody>
    </Card>
  );
}
