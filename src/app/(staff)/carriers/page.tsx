import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { CarriersTable } from "@/modules/carriers/carriers-table";
import { listCarriers } from "@/modules/carriers/queries";

export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; archived?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Number(sp.page) || 1;
  const archived = sp.archived === "1";
  const t = await getTranslations();
  const { rows, total } = await listCarriers({ q, page, archived });

  return (
    <div>
      <PageHeader
        title={t("nav.carriers")}
        action={
          <Link href="/carriers/new" className="btn-primary">
            + {t("carriers.newCarrier")}
          </Link>
        }
      />
      <div className="mb-3 flex items-center justify-between gap-3">
        <form action="/carriers">
          <input
            name="q"
            defaultValue={q}
            placeholder={t("carriers.searchPlaceholder")}
            className="w-72 rounded-[10px] border border-edge-chip bg-surface-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/55 focus:border-edge-focus"
          />
        </form>
        <Link
          href={archived ? "/carriers" : "/carriers?archived=1"}
          className={`rounded-full border px-3 py-1 text-xs ${archived ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
        >
          {archived ? t("actions.showActive") : t("actions.showArchived")}
        </Link>
      </div>
      <CarriersTable rows={rows} />
      <Paginator page={page} total={total} basePath="/carriers" params={q ? { q } : {}} />
    </div>
  );
}
