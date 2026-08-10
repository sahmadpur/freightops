import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { RankBars } from "@/components/dashboard/rank-bars";
import { formatHours, formatPercent } from "@/lib/duration";
import type { RequestKpis } from "./kpi";

/**
 * The §22 commercial KPIs. Every figure here comes from a timestamp the request
 * stored as it happened, which is why §23 insists they be captured from day
 * one — the dashboard could be built later, but the data could not.
 */
export async function RequestKpiSection({ kpis }: { kpis: RequestKpis }) {
  const t = await getTranslations("requestKpi");
  const tls = await getTranslations("leadSource");
  const tlr = await getTranslations("lostReason");

  const tile = (label: string, value: string | number, hint?: string) => (
    <Card interactive>
      <CardBody>
        <div className="text-xs font-medium text-ink-soft">{label}</div>
        <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink">{value}</div>
        {hint && <div className="mt-0.5 text-[11px] text-ink-soft">{hint}</div>}
      </CardBody>
    </Card>
  );

  const durationLabel: Record<string, string> = {
    registration: t("registrationTime"),
    timeToQuote: t("timeToQuote"),
    clientDecision: t("clientDecisionTime"),
    requestToOrder: t("requestToOrderTime"),
  };

  return (
    <section className="mb-5">
      <div className="mb-2.5">
        <span className="eyebrow">{t("title")}</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tile(t("totalRequests"), kpis.total)}
        {tile(t("quotationSent"), kpis.quotationSent)}
        {tile(t("won"), kpis.won)}
        {tile(t("lost"), kpis.lost)}
        {/* Both formulas, side by side: §22 asks for the basis to be switchable,
            and showing them together is more useful than a toggle. */}
        {tile(
          t("conversionRate"),
          formatPercent(kpis.conversionAll),
          `${t("ofQuoted")}: ${formatPercent(kpis.conversionQuoted)}`,
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("bySource")}</span>
          </CardHeader>
          <CardBody>
            <RankBars
              rows={kpis.bySource.map((r) => ({ key: r.key, label: tls(r.key), value: r.count }))}
              empty={t("noData")}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("byManager")}</span>
          </CardHeader>
          <CardBody>
            <RankBars
              rows={kpis.byManager.map((r) => ({
                key: r.key,
                label: r.label,
                value: r.count,
                caption: `${t("wonShort")} ${r.won}`,
              }))}
              empty={t("noData")}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("lostReasons")}</span>
          </CardHeader>
          <CardBody>
            <RankBars
              rows={kpis.lostReasons.map((r) => ({ key: r.key, label: tlr(r.key), value: r.count }))}
              empty={t("noData")}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("speed")}</span>
          </CardHeader>
          <CardBody>
            {kpis.durations.map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between border-b border-edge-soft py-2 text-sm last:border-0"
              >
                <span className="text-ink-soft">{durationLabel[d.key]}</span>
                <span className="text-right">
                  <span className="font-semibold tabular-nums text-ink">{formatHours(d.medianHours)}</span>
                  {/* The mean sits underneath: a big gap between the two is
                      itself the signal that something sat forgotten. */}
                  <span className="block text-[11px] text-ink-soft">
                    {t("mean")} {formatHours(d.meanHours)} · n={d.samples}
                  </span>
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
