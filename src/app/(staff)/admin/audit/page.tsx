import { getTranslations, getFormatter } from "next-intl/server";
import { requireArea } from "@/lib/session";
import { Card, CardBody } from "@/components/ui/card";
import { Paginator } from "@/components/ui/paginator";
import { listAuditLog, distinctAuditEntityTypes } from "@/modules/admin/queries";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; q?: string; page?: string }>;
}) {
  await requireArea("admin");
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [{ rows, total }, types] = await Promise.all([
    listAuditLog({ entityType: sp.entityType, q: sp.q, page }),
    distinctAuditEntityTypes(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("auditTitle")}</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <select name="entityType" defaultValue={sp.entityType ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">{t("allTypes")}</option>
          {types.map((ty) => (<option key={ty} value={ty}>{ty}</option>))}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder={t("search")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm text-white">{t("filter")}</button>
      </form>

      <Card>
        <CardBody>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noAuditEntries")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1">{t("auditTime")}</th>
                  <th className="py-1">{t("auditActor")}</th>
                  <th className="py-1">{t("auditAction")}</th>
                  <th className="py-1">{t("auditEntity")}</th>
                  <th className="py-1">{t("auditChange")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 whitespace-nowrap text-slate-500">{format.dateTime(r.createdAt, { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="py-1.5">{r.actorName ?? r.actorEmail ?? "—"}</td>
                    <td className="py-1.5">{r.action}</td>
                    <td className="py-1.5 text-slate-500">{r.entityType} <span className="text-slate-300">·</span> <span className="font-mono text-[11px]">{r.entityId.slice(0, 8)}</span></td>
                    <td className="py-1.5 text-slate-600">
                      {r.field ? (
                        <span>{r.field}: <span className="text-slate-400">{r.oldValue ?? "∅"}</span> → {r.newValue ?? "∅"}</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Paginator
            page={page}
            total={total}
            basePath="/admin/audit"
            params={{ ...(sp.entityType ? { entityType: sp.entityType } : {}), ...(sp.q ? { q: sp.q } : {}) }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
