import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { AccountsTable } from "@/modules/accounts/accounts-table";
import { listAccounts } from "@/modules/accounts/queries";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Number(sp.page) || 1;
  const t = await getTranslations();
  const { rows, total } = await listAccounts({ q, page });

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
      <form className="mb-3" action="/accounts">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("accounts.searchPlaceholder")}
          className="w-72 rounded-[5px] border border-edge-chip bg-surface-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/55 focus:border-edge-focus"
        />
      </form>
      <AccountsTable rows={rows} />
      <Paginator page={page} total={total} basePath="/accounts" params={q ? { q } : {}} />
    </div>
  );
}
