import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SectionRule, DefRow } from "@/components/ui/record";
import { ArchiveButton } from "@/components/ui/archive-button";
import { MoneyDual } from "@/components/ui/money";
import { formatMoney } from "@/lib/money";
import { requireArea } from "@/lib/session";
import { getCustomsClearance } from "@/modules/customs/queries";
import { archiveCustomsClearance, restoreCustomsClearance } from "@/modules/customs/actions";

export default async function CustomsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireArea("staff");
  const t = await getTranslations();
  const data = await getCustomsClearance(id);
  if (!data) notFound();
  const { clearance: c, items, totals, orderNumber, orderTitle, accountTitle } = data;

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-px w-4 bg-brand-accent" aria-hidden="true" />
              <span className="font-display text-[13px] font-medium tracking-[-0.01em] text-brand-deep">
                {t("nav.customs")} · {c.number}
              </span>
            </div>
            <h1 className="font-display text-[26px] font-medium leading-[1.05] tracking-[-0.01em] text-brand-deep">
              {c.description || t("customs.untitled")}
            </h1>
          </div>
          <Link href={`/customs/${c.id}/edit`} className="btn-secondary">
            {t("actions.edit")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-7">
          <section>
            <SectionRule>{t("customs.sectionSubject")}</SectionRule>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
              <DefRow
                label={t("customs.order")}
                value={
                  c.orderId && orderNumber ? (
                    <Link href={`/orders/${c.orderId}`} className="text-brand hover:underline">
                      {orderNumber} — {orderTitle}
                    </Link>
                  ) : (
                    t("customs.standalone")
                  )
                }
              />
              <DefRow label={t("fields.client")} value={accountTitle} />
              <DefRow label={t("customs.declarationNumber")} value={c.declarationNumber} />
              <DefRow label={t("customs.clearedAt")} value={c.clearedAt} />
              <DefRow label={t("fields.currency")} value={c.currency} />
              <DefRow label={t("fields.exchangeRate")} value={c.exchangeRate} />
              <DefRow label={t("fields.notes")} value={c.notes} className="sm:col-span-3" />
            </dl>
          </section>

          <section>
            <SectionRule>{t("customs.costs")}</SectionRule>
            {items.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("customs.noItems")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-[13px]">
                  <thead>
                    <tr className="border-b border-edge-chip text-left text-[11.5px] font-medium text-ink-soft">
                      <th className="py-1.5 pr-3">{t("customs.category")}</th>
                      <th className="py-1.5 pr-3 text-right">{t("customs.buy")}</th>
                      <th className="py-1.5 pr-3 text-right">{t("customs.sell")}</th>
                      <th className="py-1.5 pr-3 text-right">{t("customs.margin")}</th>
                      <th className="py-1.5">{t("fields.note")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => {
                      const margin = Number(i.sellAmount ?? 0) - Number(i.buyAmount ?? 0);
                      return (
                        <tr key={i.id} className="border-b border-edge-soft last:border-0">
                          <td className="py-1.5 pr-3">{t(`customsCategory.${i.category}`)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {i.buyAmount ? formatMoney(Math.round(Number(i.buyAmount) * 100), c.currency) : "—"}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {i.sellAmount ? formatMoney(Math.round(Number(i.sellAmount) * 100), c.currency) : "—"}
                          </td>
                          <td
                            className={`py-1.5 pr-3 text-right tabular-nums ${margin < 0 ? "text-rose-600" : ""}`}
                          >
                            {formatMoney(Math.round(margin * 100), c.currency)}
                          </td>
                          <td className="py-1.5 text-ink-soft">{i.note ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-7 lg:sticky lg:top-4 lg:self-start">
          <div>
            <SectionRule>{t("customs.totals")}</SectionRule>
            <dl className="space-y-1.5 text-[13px]">
              <Row label={t("customs.totalBuy")} value={<MoneyDual cents={totals.buyCents} currency={c.currency} rate={c.exchangeRate} />} />
              <Row label={t("customs.totalSell")} value={<MoneyDual cents={totals.sellCents} currency={c.currency} rate={c.exchangeRate} />} />
              <div className="border-t border-edge-soft pt-1.5">
                <Row
                  label={t("customs.margin")}
                  value={
                    <span className={totals.marginCents < 0 ? "text-rose-600" : "text-emerald-600"}>
                      <MoneyDual cents={totals.marginCents} currency={c.currency} rate={c.exchangeRate} />
                    </span>
                  }
                />
              </div>
            </dl>
          </div>
          <div>
            {c.deletedAt ? (
              <ArchiveButton
                mode="restore"
                label={t("actions.restore")}
                action={restoreCustomsClearance.bind(null, c.id)}
              />
            ) : (
              <ArchiveButton
                mode="archive"
                label={t("actions.archive")}
                confirm={t("actions.confirmArchive")}
                redirectTo="/customs"
                action={archiveCustomsClearance.bind(null, c.id)}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
