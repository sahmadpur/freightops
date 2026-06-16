import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { CarriersTable } from "@/modules/carriers/carriers-table";
import { listCarriers } from "@/modules/carriers/queries";

export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Number(sp.page) || 1;
  const t = await getTranslations();
  const { rows, total } = await listCarriers({ q, page });

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
      <form className="mb-3" action="/carriers">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("carriers.searchPlaceholder")}
          className="w-72 rounded-[5px] border border-edge-chip bg-surface-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/55 focus:border-edge-focus"
        />
      </form>
      <CarriersTable rows={rows} />
      <Paginator page={page} total={total} basePath="/carriers" params={q ? { q } : {}} />
    </div>
  );
}
