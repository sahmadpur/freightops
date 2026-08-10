import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRule } from "@/components/ui/record";
import { StatusBadge } from "@/components/ui/status-badge";
import { inputCls } from "@/components/ui/form";
import { requireArea } from "@/lib/session";
import { countryLabel, routeLabel } from "@/lib/countries";
import { formatDateTime } from "@/lib/datetime";
import { listRequests } from "@/modules/requests/queries";
import { listOrders } from "@/modules/orders/queries";

/**
 * Global search across both halves of the pipeline (§21). A REQ number, an ORD
 * number, an email subject or a city all land here, because the desk knows the
 * reference before it knows which entity the reference belongs to.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireArea("staff");
  const { q: raw } = await searchParams;
  const q = raw?.trim() || undefined;
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);

  const [requests, orders] = q
    ? await Promise.all([listRequests({ q }), listOrders({ q })])
    : [{ rows: [], total: 0 }, { rows: [], total: 0 }];

  const rowCls = "flex items-baseline justify-between gap-4 border-b border-edge-soft py-2.5 last:border-0";

  return (
    <div className="max-w-4xl">
      <PageHeader title={t("search.title")} />

      <form action="/search" className="mb-6">
        <input name="q" defaultValue={q} placeholder={t("search.placeholder")} className={inputCls} autoFocus />
      </form>

      {!q ? (
        <p className="text-sm text-ink-soft">{t("search.prompt")}</p>
      ) : requests.total === 0 && orders.total === 0 ? (
        <p className="text-sm text-ink-soft">{t("search.noResults")}</p>
      ) : (
        <div className="space-y-8">
          {requests.rows.length > 0 && (
            <section>
              <SectionRule>
                {t("search.requests")} · {requests.total}
              </SectionRule>
              {requests.rows.map((r) => (
                <div key={r.id} className={rowCls}>
                  <span className="min-w-0">
                    <Link href={`/requests/${r.id}`} className="font-medium text-brand hover:underline">
                      {r.number}
                    </Link>
                    <span className="text-ink"> · {r.title}</span>
                    <span className="block text-[11.5px] text-ink-soft">
                      {[
                        r.accountTitle,
                        [
                          r.originCity || countryLabel(r.originCountry, locale),
                          r.destinationCity || countryLabel(r.destinationCountry, locale),
                        ]
                          .filter(Boolean)
                          .join(" → ") || null,
                        formatDateTime(r.receivedAt, locale, "short"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </section>
          )}

          {orders.rows.length > 0 && (
            <section>
              <SectionRule>
                {t("search.orders")} · {orders.total}
              </SectionRule>
              {orders.rows.map((o) => (
                <div key={o.id} className={rowCls}>
                  <span className="min-w-0">
                    <Link href={`/orders/${o.id}`} className="font-medium text-brand hover:underline">
                      {o.number}
                    </Link>
                    <span className="text-ink"> · {o.title}</span>
                    <span className="block text-[11.5px] text-ink-soft">
                      {[o.accountTitle, routeLabel(o.fromCountry, o.toCountry, locale)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
