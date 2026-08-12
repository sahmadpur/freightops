import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { AccountsTable } from "@/modules/accounts/accounts-table";
import { listAccounts } from "@/modules/accounts/queries";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; archived?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Number(sp.page) || 1;
  const archived = sp.archived === "1";
  const t = await getTranslations();
  const { rows, total } = await listAccounts({ q, page, archived });

  return (
    <div>
      <PageHeader
        title={t("nav.accounts")}
        action={
          <Link href="/accounts/new" className="btn-primary">
            + {t("accounts.newAccount")}
          </Link>
        }
      />
      <div className="mb-3 flex items-center justify-between gap-3">
        <form action="/accounts">
          <input
            name="q"
            defaultValue={q}
            placeholder={t("accounts.searchPlaceholder")}
            className="w-72 rounded-control border border-edge-chip bg-surface-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/55 focus:border-edge-focus"
          />
        </form>
        <Link
          href={archived ? "/accounts" : "/accounts?archived=1"}
          className={`rounded-full border px-3 py-1 text-xs ${archived ? "border-indigo-600 bg-indigo-600 text-brand-pale" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
        >
          {archived ? t("actions.showActive") : t("actions.showArchived")}
        </Link>
      </div>
      <AccountsTable rows={rows} />
      <Paginator page={page} total={total} basePath="/accounts" params={q ? { q } : {}} />
    </div>
  );
}
