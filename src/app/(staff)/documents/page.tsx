import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { inputCls } from "@/components/ui/form";
import { listDocumentsByOrder } from "@/modules/documents/queries";
import { docTypeEnum } from "@/db/schema";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const type = sp.type || undefined;
  const t = await getTranslations();
  const groups = await listDocumentsByOrder({ q, docType: type });

  return (
    <div>
      <PageHeader title={t("documents.title")} />
      <form className="mb-4 flex flex-wrap gap-2" action="/documents">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("documents.searchPlaceholder")}
          className={`${inputCls} w-80`}
        />
        <select name="type" defaultValue={type ?? ""} className={`${inputCls} w-52`}>
          <option value="">{t("documents.allTypes")}</option>
          {docTypeEnum.enumValues.map((d) => (
            <option key={d} value={d}>{t(`docType.${d}`)}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          {t("common.search")}
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-400">{t("documents.empty")}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.orderId}>
              <CardHeader>
                <Link href={`/orders/${g.orderId}`} className="text-sm font-semibold text-[#1a3a5c] hover:underline">
                  {g.orderNumber} · {g.orderTitle}
                </Link>
                <span className="text-xs text-slate-400">{g.accountTitle}</span>
              </CardHeader>
              <CardBody>
                <ul className="space-y-1.5">
                  {g.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 truncate">
                        <span className="font-medium">{d.fileName}</span>
                        <span className="ml-2 text-xs text-slate-400">{t(`docType.${d.docType}`)}</span>
                      </span>
                      {d.visibleToClient ? (
                        <span className="rounded-full bg-[#d4f2e7] px-2 py-0.5 text-[10.5px] text-[#085041]">{t("documents.clientVisible")}</span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10.5px] text-slate-600">{t("documents.internal")}</span>
                      )}
                      <a href={`/api/documents/${d.id}/download`} className="text-xs text-[#1a3a5c] hover:underline">
                        {t("documents.download")}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
