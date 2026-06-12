import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAccount } from "@/modules/accounts/queries";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const format = await getFormatter();
  const data = await getAccount(id);
  if (!data) notFound();
  const { account, contacts, orders } = data;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={account.title}
        action={
          <Link
            href={`/accounts/${account.id}/edit`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {t("actions.edit")}
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("nav.accounts")}</span>
          </CardHeader>
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">{t("fields.taxId")}</dt>
                <dd>{account.taxId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("fields.address")}</dt>
                <dd>{account.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("fields.notes")}</dt>
                <dd className="whitespace-pre-wrap">{account.notes ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("fields.createdAt")}</dt>
                <dd>{format.dateTime(account.createdAt, { dateStyle: "medium" })}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("fields.contacts")}</span>
          </CardHeader>
          <CardBody>
            {contacts.length === 0 && <p className="text-sm text-slate-400">—</p>}
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="font-medium">{c.name}</div>
                  {c.phones.length > 0 && <div className="text-slate-500">{c.phones.join(" · ")}</div>}
                  {c.emails.length > 0 && <div className="text-slate-500">{c.emails.join(" · ")}</div>}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <span className="text-sm font-semibold">{t("fields.orderHistory")}</span>
        </CardHeader>
        <CardBody>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">{t("fields.noOrdersYet")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 first:border-0">
                    <td className="py-2 font-medium text-[#1a3a5c]">{o.number}</td>
                    <td className="py-2">{o.title}</td>
                    <td className="py-2">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-2 text-slate-500">
                      {format.dateTime(o.createdAt, { dateStyle: "medium" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
