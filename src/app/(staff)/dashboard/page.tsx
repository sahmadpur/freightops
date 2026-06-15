import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBar } from "@/components/dashboard/status-bar";
import { dashboardData } from "@/modules/finance/queries";
import { formatMoney } from "@/lib/money";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const d = await dashboardData();
  const year = new Date().getFullYear();

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
        {formatMoney(cents)}
      </span>
    </div>
  );

  return (
    <div>
      <PageHeader title={t("title")} />

      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("operationalOverview")}</div>
      <div className="mb-5 grid grid-cols-4 gap-3">
        {metric(t("activeShipments"), d.operational.activeShipments, <IconTruck />, "indigo")}
        {metric(t("cargoInTransit"), d.operational.cargoInTransit, <IconRoute />, "violet")}
        {metric(t("atCustoms"), d.operational.atCustoms, <IconStamp />, "indigo")}
        {metric(t("unfinishedOrders"), d.operational.unfinishedOrders, <IconClipboard />, "violet")}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
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

      <Card className="mb-4">
        <CardHeader><span className="text-sm font-semibold">{t("ordersByStatus")}</span></CardHeader>
        <CardBody><StatusBar counts={d.statusCounts} /></CardBody>
      </Card>

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
                      <td className="py-2 pr-4">{formatMoney(m.revenueCents)}</td>
                      <td className="py-2 pr-4">{formatMoney(m.carrierCostCents)}</td>
                      <td className="py-2 pr-4">{formatMoney(m.expectedProfitCents)}</td>
                      <td className="py-2 pr-4">{formatMoney(m.actualProfitCents)}</td>
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
