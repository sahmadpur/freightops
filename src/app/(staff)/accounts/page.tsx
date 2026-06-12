import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
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
          <Link
            href="/accounts/new"
            className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white"
          >
            + {t("accounts.newAccount")}
          </Link>
        }
      />
      <form className="mb-3" action="/accounts">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("accounts.searchPlaceholder")}
          className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3a5c]"
        />
      </form>
      <Card>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.companyTitle")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.taxId")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.contacts")} 1</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.contacts")} 2</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.phones")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.emails")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.orders")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.actionsCol")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3.5 py-8 text-center text-slate-400">
                  {t("accounts.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3.5 py-2.5 font-medium">{r.title}</td>
                <td className="px-3.5 py-2.5 text-slate-500">{r.taxId ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact1?.name ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact2Name ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact1?.phone ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact1?.email ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.orderCount}</td>
                <td className="px-3.5 py-2.5">
                  <span className="flex gap-2 text-xs">
                    <Link className="text-[#1a3a5c] hover:underline" href={`/accounts/${r.id}`}>
                      {t("actions.view")}
                    </Link>
                    <Link className="text-[#1a3a5c] hover:underline" href={`/accounts/${r.id}/edit`}>
                      {t("actions.edit")}
                    </Link>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Paginator page={page} total={total} basePath="/accounts" params={q ? { q } : {}} />
    </div>
  );
}
