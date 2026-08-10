import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RequestKpiSection } from "@/modules/requests/kpi-section";
import { requestKpis } from "@/modules/requests/kpi";
import { StatusBar } from "@/components/dashboard/status-bar";
import { RankBars } from "@/components/dashboard/rank-bars";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { dashboardData, monthRange, reconciliationRows } from "@/modules/finance/queries";
import { customsPeriodTotals } from "@/modules/customs/queries";
import { ReconciliationReport } from "@/modules/finance/reconciliation-report";
import { formatMoneyAzn } from "@/lib/money";
import { routeLabel } from "@/lib/countries";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const t = await getTranslations("dashboard");
  const tt = await getTranslations();
  const locale = await getLocale();
  const { from, to } = monthRange(monthParam);
  const [d, reconRows, customs, kpis] = await Promise.all([
    dashboardData(monthParam),
    reconciliationRows(),
    customsPeriodTotals(from, to),
    requestKpis(monthParam),
  ]);
  const year = d.year;

  const metric = (
    label: string,
    value: string | number,
    icon: React.ReactNode,
    accent: "indigo" | "violet",
  ) => (
    <Card interactive>
      <CardBody>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            accent === "indigo"
              ? "bg-indigo-50 text-indigo-600"
              : "bg-violet-50 text-violet-600"
          }`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="mt-3 text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">
          {value}
        </div>
      </CardBody>
    </Card>
  );

  const stat = (label: string, value: string) => (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold tabular-nums text-slate-900">{value}</span>
    </div>
  );

  const fin = (label: string, cents: number, tone?: "pos" | "neg") => (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-600">{label}</span>
      <span
        className={`font-semibold tabular-nums ${
          tone === "pos"
            ? "text-emerald-600"
            : tone === "neg"
              ? "text-rose-600"
              : "text-slate-900"
        }`}
      >
        {formatMoneyAzn(cents)}
      </span>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={t("title")}
        action={<MonthPicker month={d.month} label={t("period")} />}
      />

      {/* The commercial funnel comes first: it is what feeds everything below it. */}
      <RequestKpiSection kpis={kpis} />

      <div className="mb-2.5"><span className="eyebrow">{t("operationalOverview")}</span></div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metric(t("activeShipments"), d.operational.activeShipments, <IconTruck />, "indigo")}
        {metric(t("inOperations"), d.operational.inOperations, <IconClipboard />, "violet")}
        {metric(t("cargoInTransit"), d.operational.cargoInTransit, <IconRoute />, "violet")}
        {metric(t("bookedWithCarrier"), d.operational.bookedWithCarrier, <IconStamp />, "indigo")}
        {metric(t("unfinishedOrders"), d.operational.unfinishedOrders, <IconClipboard />, "violet")}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("periodResults", { month: d.month })}</span>
            <span className="text-xs text-slate-500">{t("ordersCount", { count: d.period.orders })}</span>
          </CardHeader>
          <CardBody>
            {fin(t("revenue"), d.period.revenueCents, "pos")}
            {fin(t("carrierCosts"), -d.period.carrierCostCents, "neg")}
            {fin(t("expectedProfit"), d.period.expectedProfitCents, "pos")}
            {fin(t("actualProfit"), d.period.actualProfitCents, "pos")}
            {d.period.unratedOrders > 0 && (
              <p className="mt-2 text-[11px] text-ink-soft">
                {t("unratedNote", { count: d.period.unratedOrders })}
              </p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("financialOverview")}</span></CardHeader>
          <CardBody>
            {fin(t("revenue"), d.financial.ytd.revenueCents, "pos")}
            {fin(t("carrierCosts"), -d.financial.ytd.carrierCostsCents, "neg")}
            {fin(t("expectedProfit"), d.financial.ytd.expectedProfitCents, "pos")}
            {fin(t("actualProfit"), d.financial.ytd.actualProfitCents, "pos")}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("balancesOverview")}</span></CardHeader>
          <CardBody>
            {fin(t("accountsReceivable"), d.financial.clients.outstandingCents)}
            {fin(t("owedToCarriers"), d.financial.carriers.outstandingCents, "neg")}
          </CardBody>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader><span className="text-sm font-semibold">{tt("fields.transportType")}</span></CardHeader>
          <CardBody>
            <RankBars
              empty={t("noData")}
              rows={d.byTransportType.map((r) => ({
                key: r.transportType ?? "none",
                label: r.transportType ? tt(`transportTypes.${r.transportType}`) : "—",
                value: r.count,
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("topRoutes")}</span></CardHeader>
          <CardBody>
            <RankBars
              empty={t("noData")}
              rows={d.topRoutes.map((r) => ({
                key: `${r.fromCountry}-${r.toCountry}`,
                label: routeLabel(r.fromCountry, r.toCountry, locale) ?? "—",
                value: r.count,
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("topClients")}</span></CardHeader>
          <CardBody>
            <RankBars
              empty={t("noData")}
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
          <CardHeader>
            <span className="text-sm font-semibold">{tt("nav.customs")}</span>
            <Link href="/customs" className="text-xs text-brand hover:underline">
              {tt("actions.view")}
            </Link>
          </CardHeader>
          <CardBody>
            {stat(t("clearances"), String(customs.count))}
            {fin(tt("customs.totalBuy"), -customs.buyCents, "neg")}
            {fin(tt("customs.totalSell"), customs.sellCents, "pos")}
            {fin(tt("customs.margin"), customs.marginCents, customs.marginCents < 0 ? "neg" : "pos")}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader><span className="text-sm font-semibold">{t("ordersByStatus")}</span></CardHeader>
        <CardBody><StatusBar counts={d.statusCounts} /></CardBody>
      </Card>

      <div className="mb-4">
        <ReconciliationReport rows={reconRows} />
      </div>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("monthlyResults", { year })}</span></CardHeader>
        <CardBody>
          {d.monthly.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2 pr-4 font-semibold">{t("month")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("revenue")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("carrierCosts")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("expectedProfit")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("actualProfit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.monthly.map((m) => (
                    <tr key={m.month} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-medium">{m.month}</td>
                      <td className="py-2 pr-4">{formatMoneyAzn(m.revenueCents)}</td>
                      <td className="py-2 pr-4">{formatMoneyAzn(m.carrierCostCents)}</td>
                      <td className="py-2 pr-4">{formatMoneyAzn(m.expectedProfitCents)}</td>
                      <td className="py-2 pr-4">{formatMoneyAzn(m.actualProfitCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* --- Operational metric glyphs (inline so no icon dependency is needed) --- */

const svg = "h-5 w-5";
const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: svg,
  "aria-hidden": true,
};

function IconTruck() {
  return (
    <svg {...svgProps}>
      <path d="M14 18V6a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1" />
      <path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-1" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

function IconRoute() {
  return (
    <svg {...svgProps}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h6a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h4" />
    </svg>
  );
}

function IconStamp() {
  return (
    <svg {...svgProps}>
      <path d="M5 22h14M5 18h14M9 14a4 4 0 1 1 6 0c0 1.5-1 2-1 3v1H10v-1c0-1-1-1.5-1-3Z" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg {...svgProps}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}
