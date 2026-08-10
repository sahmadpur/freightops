"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { inputCls } from "@/components/ui/form";
import { FilePicker } from "@/components/ui/file-picker";
import type { DocumentRow as DocRow } from "./queries";
import { uploadDocument } from "./actions";
import { DocumentRow } from "./document-row";

// Mirror of docTypeEnum (src/db/schema). Hardcoded to keep the Drizzle schema out of
// the client bundle, matching how order-form/status-control list their enums.
const DOC_TYPES = ["cmr", "awb", "bill_of_lading", "invoice", "packing_list", "certificate", "act", "waybill", "cargo_photos", "other"] as const;

export function DocumentsTab({
  orderId,
  documents,
  parentType = "order",
}: {
  orderId: string;
  documents: DocRow[];
  parentType?: "order" | "customs_clearance" | "request";
}) {
  const t = useTranslations("documents");
  const tf = useTranslations("fields");
  const td = useTranslations("docType");
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState<string>("other");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonLabel = (reason?: string) =>
    reason === "too_large" ? t("tooLarge")
    : reason === "type" ? t("badType")
    : reason === "empty" ? t("emptyFile")
    : t("uploadFailed");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setPending(true);
    setError(null);
    // One request per file: uploadDocument writes to S3 then the DB per
    // document, so a bad file fails alone instead of taking the batch with it.
    const failed: string[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("parentType", parentType);
      fd.set("parentId", orderId);
      fd.set("docType", docType);
      fd.set("visibleToClient", visible ? "true" : "false");
      try {
        const r = await uploadDocument(fd);
        if (!r.ok) failed.push(`${file.name}: ${reasonLabel(r.error)}`);
      } catch {
        failed.push(`${file.name}: ${t("uploadFailed")}`);
      }
    }
    setPending(false);
    if (failed.length > 0) {
      setError(failed.join("; "));
      return;
    }
    setFiles([]);
    setVisible(false);
    setDocType("other");
    router.refresh();
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
          <div className="w-full">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="file">{t("fileLabel")}</label>
            <FilePicker
              id="file"
              files={files}
              onChange={setFiles}
              addLabel={t("addFiles")}
              emptyLabel={t("noFilesSelected")}
              removeLabel={tf("remove")}
              errorLabels={{
                tooLarge: t("tooLarge"),
                badType: t("badType"),
                emptyFile: t("emptyFile"),
              }}
              onReject={setError}
              disabled={pending}
            />
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
            disabled={pending || files.length === 0}
            className="mb-1 btn-primary"
          >
            {pending ? t("uploading") : t("upload")}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </CardBody>
    </Card>
  );
}
