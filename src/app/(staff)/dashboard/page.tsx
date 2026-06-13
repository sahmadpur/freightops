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

  const metric = (label: string, value: string | number, sub?: string) => (
    <Card>
      <CardBody>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
      </CardBody>
    </Card>
  );

  const fin = (label: string, cents: number, tone?: "pos" | "neg") => (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span>{label}</span>
      <span className={`font-semibold ${tone === "pos" ? "text-[#3b6d11]" : tone === "neg" ? "text-[#a32d2d]" : ""}`}>
        {formatMoney(cents)}
      </span>
    </div>
  );

  return (
    <div>
      <PageHeader title={t("title")} />

      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("operationalOverview")}</div>
      <div className="mb-5 grid grid-cols-4 gap-3">
        {metric(t("activeShipments"), d.operational.activeShipments)}
        {metric(t("cargoInTransit"), d.operational.cargoInTransit)}
        {metric(t("atCustoms"), d.operational.atCustoms)}
        {metric(t("unfinishedOrders"), d.operational.unfinishedOrders)}
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
          <CardHeader><span className="text-sm font-semibold">{t("financialOverview")}</span></CardHeader>
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
