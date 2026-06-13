import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { financeTotals } from "@/modules/finance/queries";
import { formatMoney } from "@/lib/money";

export default async function FinancePage() {
  const t = await getTranslations("finance");
  const totals = await financeTotals();
  const year = new Date().getFullYear();

  const fin = (label: string, cents: number, tone?: "pos" | "neg") => (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span>{label}</span>
      <span className={`font-semibold ${tone === "pos" ? "text-[#3b6d11]" : tone === "neg" ? "text-[#a32d2d]" : ""}`}>
        {formatMoney(cents)}
      </span>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title={t("title")} />
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("clients")}</span></CardHeader>
          <CardBody>
            {fin(t("totalReceivable"), totals.clients.totalReceivableCents)}
            {fin(t("totalReceived"), totals.clients.totalReceivedCents, "pos")}
            {fin(t("outstanding"), totals.clients.outstandingCents, "neg")}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("carriers")}</span></CardHeader>
          <CardBody>
            {fin(t("totalPayable"), totals.carriers.totalPayableCents)}
            {fin(t("totalPaid"), totals.carriers.totalPaidCents, "pos")}
            {fin(t("outstanding"), totals.carriers.outstandingCents, "neg")}
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><span className="text-sm font-semibold">{t("ytdResults", { year })}</span></CardHeader>
        <CardBody>
          {fin(t("totalRevenue"), totals.ytd.revenueCents, "pos")}
          {fin(t("totalCarrierCosts"), -totals.ytd.carrierCostsCents, "neg")}
          {fin(t("additionalExpenses"), -totals.ytd.additionalCents, "neg")}
          {fin(t("expectedProfitOpen"), totals.ytd.expectedProfitCents, "pos")}
          {fin(t("actualProfitCompleted"), totals.ytd.actualProfitCents, "pos")}
        </CardBody>
      </Card>
    </div>
  );
}
