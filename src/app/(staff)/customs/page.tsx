import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { inputCls } from "@/components/ui/form";
import { CustomsTable } from "@/modules/customs/customs-table";
import { listCustomsClearances } from "@/modules/customs/queries";

export default async function CustomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; archived?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Number(sp.page) || 1;
  const archived = sp.archived === "1";
  const t = await getTranslations();
  const { rows, total } = await listCustomsClearances({ q, page, archived });

  return (
    <div>
      <PageHeader
        title={t("nav.customs")}
        action={
          <Link href="/customs/new" className="btn-primary">
            + {t("customs.newClearance")}
          </Link>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form action="/customs">
          {archived && <input type="hidden" name="archived" value="1" />}
          <input
            name="q"
            defaultValue={q}
            placeholder={t("customs.searchPlaceholder")}
            className={`${inputCls} w-80`}
          />
        </form>
        <Link
          href={archived ? "/customs" : "/customs?archived=1"}
          className={`ml-auto rounded-full border px-3 py-1 text-xs ${archived ? "border-indigo-600 bg-indigo-600 text-brand-pale" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
        >
          {archived ? t("actions.showActive") : t("actions.showArchived")}
        </Link>
      </div>
      <CustomsTable rows={rows} />
      <Paginator
        page={page}
        total={total}
        basePath="/customs"
        params={{ ...(q ? { q } : {}), ...(archived ? { archived: "1" } : {}) }}
      />
    </div>
  );
}
