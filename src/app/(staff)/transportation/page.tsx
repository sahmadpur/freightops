import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { listTransportModes } from "@/modules/transport/queries";

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function TransportationPage() {
  const t = await getTranslations();
  const modes = await listTransportModes();

  return (
    <div>
      <PageHeader
        title={t("nav.transportation")}
        action={
          <Link href="/transportation/new" className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white">
            + {t("transport.newTransport")}
          </Link>
        }
      />
      {modes.length === 0 && <p className="text-sm text-slate-400">{t("transport.empty")}</p>}
      <div className="space-y-3">
        {modes.map((m) => (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {m.number}
                  {m.derivedStatus && <StatusBadge status={m.derivedStatus} />}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {m.modeType}
                  {m.route ? ` · ${m.route}` : ""}
                  {m.loadingDate ? ` · ${t("fields.loadingDate")}: ${m.loadingDate}` : ""}
                  {m.plannedArrivalDate ? ` · ${t("fields.plannedArrivalDate")}: ${m.plannedArrivalDate}` : ""}
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <Link className="text-[#1a3a5c] hover:underline" href={`/transportation/${m.id}`}>{t("actions.view")}</Link>
                <Link className="text-[#1a3a5c] hover:underline" href={`/transportation/${m.id}/edit`}>{t("actions.edit")}</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t("transport.ourOrdersTotal")} value={`${m.orderCount}`} />
              <Stat label={t("transport.weight")} value={`${fmt(m.ourWeightKg)}${m.totalWeightKg ? ` / ${fmt(Number(m.totalWeightKg))}` : ""} kg`} />
              <Stat label={t("transport.volume")} value={`${fmt(m.ourVolumeM3)}${m.totalVolumeM3 ? ` / ${fmt(Number(m.totalVolumeM3))}` : ""} m³`} />
              <Stat label={t("transport.revenue")} value={`$${fmt(m.revenue)}`} />
              <Stat label={t("transport.carrierCostShare")} value={`$${fmt(m.carrierCost)}`} />
              <Stat label={t("transport.profit")} value={`$${fmt(m.profit)}`} positive={m.profit >= 0} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className="text-[10.5px] text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${positive ? "text-[#3b6d11]" : ""}`}>{value}</div>
    </div>
  );
}
