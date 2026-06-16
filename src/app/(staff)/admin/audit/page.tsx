import { getTranslations } from "next-intl/server";
import { requireArea } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { AuditTable } from "@/modules/admin/audit-table";
import { listAuditLog, distinctAuditEntityTypes } from "@/modules/admin/queries";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; q?: string; page?: string }>;
}) {
  await requireArea("admin");
  const t = await getTranslations("admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [{ rows, total }, types] = await Promise.all([
    listAuditLog({ entityType: sp.entityType, q: sp.q, page }),
    distinctAuditEntityTypes(),
  ]);

  return (
    <div>
      <PageHeader title={t("auditTitle")} />

      <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
        <select
          name="entityType"
          defaultValue={sp.entityType ?? ""}
          className="rounded-[5px] border border-edge-chip bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-edge-focus"
        >
          <option value="">{t("allTypes")}</option>
          {types.map((ty) => (
            <option key={ty} value={ty}>
              {ty}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={t("search")}
          className="rounded-[5px] border border-edge-chip bg-surface-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/55 focus:border-edge-focus"
        />
        <button type="submit" className="btn-primary">
          {t("filter")}
        </button>
      </form>

      <AuditTable rows={rows} />
      <Paginator
        page={page}
        total={total}
        basePath="/admin/audit"
        params={{ ...(sp.entityType ? { entityType: sp.entityType } : {}), ...(sp.q ? { q: sp.q } : {}) }}
      />
    </div>
  );
}
