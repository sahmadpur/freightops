import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { OrderDetailTabs } from "@/modules/orders/order-detail-tabs";
import { StatusControl } from "@/modules/orders/status-control";
import { getOrder } from "@/modules/orders/queries";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const format = await getFormatter();
  const data = await getOrder(id);
  if (!data) notFound();
  const { order, accountTitle, carrierTitle, transportNumber, transportModeType, history } = data;

  const row = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );

  const info = (
    <div className="space-y-4">
      <Card>
        <CardHeader><span className="text-sm font-semibold">{order.title}</span></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {row(t("fields.client"), accountTitle)}
            {row(t("fields.clientOrderId"), order.clientOrderId)}
            {row(t("fields.carrier"), carrierTitle ?? "—")}
            {row(t("fields.route"), order.route)}
            {row(t("fields.transport"), transportNumber ? `${transportNumber} (${transportModeType})` : "—")}
            {row(t("fields.cargoDescription"), order.cargoDescription)}
            {row(t("fields.packages"), order.packages != null ? String(order.packages) : "—")}
            {row(t("fields.weightKg"), order.weightKg)}
            {row(t("fields.volumeM3"), order.volumeM3)}
            {row(t("fields.incoterms"), order.incoterms)}
            {row(t("fields.deliveryFormat"), order.deliveryFormat)}
            {row(t("fields.invoiceNumber"), order.invoiceNumber)}
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("nav.finance")}</span></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            {row(t("fields.clientCharge"), order.clientCharge ? `$${order.clientCharge}` : "—")}
            {row(t("fields.carrierCost"), order.carrierCost ? `$${order.carrierCost}` : "—")}
            {row(t("fields.additionalCosts"), order.additionalCosts ? `$${order.additionalCosts}` : "—")}
            {row(t("fields.expectedProfit"), order.expectedProfit ? `$${order.expectedProfit}` : "—")}
            {order.additionalCostsNote ? row(t("fields.additionalCosts"), order.additionalCostsNote) : null}
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("orders.updateStatus")}</span></CardHeader>
        <CardBody><StatusControl orderId={order.id} current={order.status} /></CardBody>
      </Card>
    </div>
  );

  const historyNode = (
    <Card>
      <CardHeader><span className="text-sm font-semibold">{t("orders.deliveryHistory")}</span></CardHeader>
      <CardBody>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">{t("orders.noHistory")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between border-b border-slate-100 pb-2 last:border-0">
                <span>
                  <span className="font-medium">{h.action}</span>
                  {h.field ? ` · ${h.field}: ${h.oldValue ?? "∅"} → ${h.newValue ?? "∅"}` : ""}
                </span>
                <span className="whitespace-nowrap text-xs text-slate-400">{format.dateTime(h.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {order.number} <StatusBadge status={order.status} />
          </span>
        }
        action={
          <Link href={`/orders/${order.id}/edit`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            {t("actions.edit")}
          </Link>
        }
      />
      <OrderDetailTabs info={info} history={historyNode} />
    </div>
  );
}
