import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BarChart, type ChartPoint, type ChartSeries } from "@/components/charts/bar-chart";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { RankBars } from "@/components/dashboard/rank-bars";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { routeLabel } from "@/lib/countries";
import type { AgingBucket } from "@/lib/finance";
import { formatMoneyAzn } from "@/lib/money";
import { financeStats, type AgingSide } from "@/modules/finance/queries";

const BUCKET_KEYS: Record<AgingBucket, string> = {
  "0-30": "bucket0_30",
  "31-60": "bucket31_60",
  "61-90": "bucket61_90",
  "90+": "bucket90plus",
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const t = await getTranslations("finance");
  const td = await getTranslations("dashboard");
  const tt = await getTranslations();
  const locale = await getLocale();
  const d = await financeStats(monthParam);
  const { year } = d;

  const fin = (label: string, cents: number, tone?: "pos" | "neg") => (
    <div className="flex items-center justify-between border-b border-edge-soft py-2 text-sm last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span
        className={`font-semibold tabular-nums ${
          tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-rose-600" : "text-ink"
        }`}
      >
        {formatMoneyAzn(cents)}
      </span>
    </div>
  );

  const kpi = (label: string, value: string) => (
    <Card>
      <CardBody>
        <div className="eyebrow">{label}</div>
        <div className="mt-2 font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-brand-deep">
          {value}
        </div>
      </CardBody>
    </Card>
  );

  // Charts read left-to-right; both rollups come back newest month first.
  const monthsAsc = [...d.monthly].reverse();
  const cashAsc = [...d.cashFlow].reverse();

  const trendSeries: ChartSeries[] = [
    { key: "revenue", label: td("revenue"), tone: 1 },
    { key: "cost", label: td("carrierCosts"), tone: 2 },
    { key: "profit", label: td("actualProfit"), tone: 3 },
  ];
  const trendPoints: ChartPoint[] = monthsAsc.map((m) => ({
    category: m.month.slice(5),
    values: {
      revenue: m.revenueCents,
      cost: m.carrierCostCents,
      profit: m.actualProfitCents,
    },
  }));

  const cashSeries: ChartSeries[] = [
    { key: "received", label: t("cashReceived"), tone: 1 },
    { key: "paid", label: t("cashPaid"), tone: 2 },
  ];
  const cashPoints: ChartPoint[] = cashAsc.map((m) => ({
    category: m.month.slice(5),
    values: { received: m.receivedCents, paid: m.paidCents },
  }));

  const aging = (title: string, side: AgingSide) => (
    <Card>
      <CardHeader>
        <span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{title}</span>
        <span className="text-xs tabular-nums text-ink-soft">{formatMoneyAzn(side.totalCents)}</span>
      </CardHeader>
      <CardBody>
        <RankBars
          empty={td("noData")}
          rows={side.buckets.map((b) => ({
            key: b.bucket,
            label: t(BUCKET_KEYS[b.bucket]),
            value: b.cents,
            caption: formatMoneyAzn(b.cents),
          }))}
        />
        {side.oldest.length > 0 && (
          <>
            <div className="mb-1.5 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">
              {t("oldest")}
            </div>
            <ul className="space-y-1">
              {side.oldest.map((o) => (
                <li key={o.id} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                  <Link href={`/orders/${o.id}`} className="min-w-0 truncate text-brand hover:underline">
                    <span className="font-mono">{o.number}</span> {o.title}
                  </Link>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    {formatMoneyAzn(o.cents)} · {t("daysOld", { days: o.days })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title={t("title")}
        action={<MonthPicker month={d.month} label={td("period")} basePath="/finance" />}
      />

      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <span className="eyebrow">{t("periodResults", { month: d.month })}</span>
        <span className="text-[11.5px] text-ink-soft">{t("allAmountsAzn")}</span>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpi(tt("nav.orders"), String(d.period.orders))}
        {kpi(td("revenue"), formatMoneyAzn(d.period.revenueCents))}
        {kpi(td("carrierCosts"), formatMoneyAzn(d.period.carrierCostCents))}
        {kpi(td("expectedProfit"), formatMoneyAzn(d.period.expectedProfitCents))}
        {kpi(td("actualProfit"), formatMoneyAzn(d.period.actualProfitCents))}
      </div>
      {d.period.unratedOrders > 0 && (
        <p className="mb-5 text-[11.5px] text-ink-soft">
          {td("unratedNote", { count: d.period.unratedOrders })}
        </p>
      )}

      <Card className="mb-4">
        <CardHeader><span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{t("trend", { year })}</span></CardHeader>
        <CardBody>
          <BarChart
            points={trendPoints}
            series={trendSeries}
            format={formatMoneyAzn}
            ariaLabel={t("trend", { year })}
            empty={td("noData")}
          />
          {monthsAsc.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-soft">
                    <th className="py-2 pr-4 font-semibold">{td("month")}</th>
                    <th className="py-2 pr-4 font-semibold">{td("revenue")}</th>
                    <th className="py-2 pr-4 font-semibold">{td("carrierCosts")}</th>
                    <th className="py-2 pr-4 font-semibold">{td("expectedProfit")}</th>
                    <th className="py-2 pr-4 font-semibold">{td("actualProfit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.monthly.map((m) => (
                    <tr key={m.month} className="border-t border-edge-soft">
                      <td className="py-2 pr-4 font-medium">{m.month}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatMoneyAzn(m.revenueCents)}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatMoneyAzn(m.carrierCostCents)}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatMoneyAzn(m.expectedProfitCents)}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatMoneyAzn(m.actualProfitCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardHeader><span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{t("cashFlow", { year })}</span></CardHeader>
        <CardBody>
          <BarChart
            points={cashPoints}
            series={cashSeries}
            format={formatMoneyAzn}
            ariaLabel={t("cashFlow", { year })}
            empty={td("noData")}
          />
          {cashAsc.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-soft">
                    <th className="py-2 pr-4 font-semibold">{td("month")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("cashReceived")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("cashPaid")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("netCash")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.cashFlow.map((m) => (
                    <tr key={m.month} className="border-t border-edge-soft">
                      <td className="py-2 pr-4 font-medium">{m.month}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatMoneyAzn(m.receivedCents)}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatMoneyAzn(m.paidCents)}</td>
                      <td
                        className={`py-2 pr-4 tabular-nums ${
                          m.netCents < 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {formatMoneyAzn(m.netCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mb-1.5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {aging(t("receivableAging"), d.aging.receivable)}
        {aging(t("payableAging"), d.aging.payable)}
      </div>
      <p className="mb-4 text-[11px] text-ink-soft">{t("agingNote")}</p>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{t("clients")}</span></CardHeader>
          <CardBody>
            {fin(t("totalReceivable"), d.totals.clients.totalReceivableCents)}
            {fin(t("totalReceived"), d.totals.clients.totalReceivedCents, "pos")}
            {fin(t("outstanding"), d.totals.clients.outstandingCents, "neg")}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{t("carriers")}</span></CardHeader>
          <CardBody>
            {fin(t("totalPayable"), d.totals.carriers.totalPayableCents)}
            {fin(t("totalPaid"), d.totals.carriers.totalPaidCents, "pos")}
            {fin(t("outstanding"), d.totals.carriers.outstandingCents, "neg")}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{t("ytdResults", { year })}</span></CardHeader>
          <CardBody>
            {fin(t("totalRevenue"), d.totals.ytd.revenueCents, "pos")}
            {fin(t("totalCarrierCosts"), -d.totals.ytd.carrierCostsCents, "neg")}
            {fin(t("expectedProfitOpen"), d.totals.ytd.expectedProfitCents, "pos")}
            {fin(t("actualProfitCompleted"), d.totals.ytd.actualProfitCents, "pos")}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader><span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{t("revenueByCurrency")}</span></CardHeader>
          <CardBody>
            <RankBars
              empty={td("noData")}
              rows={d.mix.byCurrency.map((r) => ({
                key: r.currency,
                label: r.currency,
                value: r.revenueCents,
                caption: formatMoneyAzn(r.revenueCents),
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{t("revenueByTransportType")}</span></CardHeader>
          <CardBody>
            <RankBars
              empty={td("noData")}
              rows={d.mix.byTransportType.map((r) => ({
                key: r.transportType ?? "none",
                label: r.transportType ? tt(`transportTypes.${r.transportType}`) : "—",
                value: r.revenueCents,
                caption: formatMoneyAzn(r.revenueCents),
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{t("topClientsByRevenue")}</span></CardHeader>
          <CardBody>
            <RankBars
              empty={td("noData")}
              rows={d.topClients.map((r) => ({
                key: r.accountId,
                label: r.accountTitle,
                value: r.revenueCents,
                caption: formatMoneyAzn(r.revenueCents),
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">{t("marginByRoute")}</span></CardHeader>
          <CardBody>
            <RankBars
              empty={td("noData")}
              rows={d.mix.byRoute.map((r) => ({
                key: `${r.fromCountry}-${r.toCountry}`,
                label: routeLabel(r.fromCountry, r.toCountry, locale) ?? "—",
                value: r.marginCents,
                caption: formatMoneyAzn(r.marginCents),
              }))}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
