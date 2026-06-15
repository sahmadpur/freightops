import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getTransportMode } from "@/modules/transport/queries";

export default async function TransportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const data = await getTransportMode(id);
  if (!data) notFound();
  const { mode, orders } = data;

  const row = (label: string, value: string | null) => (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={mode.number}
        action={
          <Link href={`/transportation/${mode.id}/edit`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            {t("actions.edit")}
          </Link>
        }
      />
      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("nav.transportation")}</span></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {row(t("fields.modeType"), mode.modeType)}
            {row(t("fields.route"), mode.route)}
            {row(t("fields.fromCountry"), mode.fromCountry)}
            {row(t("fields.toCountry"), mode.toCountry)}
            {row(t("fields.loadingDate"), mode.loadingDate)}
            {row(t("fields.plannedArrivalDate"), mode.plannedArrivalDate)}
            {row(t("fields.totalWeightKg"), mode.totalWeightKg)}
            {row(t("fields.totalVolumeM3"), mode.totalVolumeM3)}
          </dl>
        </CardBody>
      </Card>
      <Card className="mt-4">
        <CardHeader><span className="text-sm font-semibold">{t("transport.ordersOnThisTransport")}</span></CardHeader>
        <CardBody>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">{t("fields.noOrdersYet")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 first:border-0">
                    <td className="py-2">
                      <Link href={`/orders/${o.id}`} className="font-medium text-indigo-600 hover:underline">{o.number}</Link>
                    </td>
                    <td className="py-2">{o.title}</td>
                    <td className="py-2"><StatusBadge status={o.status} /></td>
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
