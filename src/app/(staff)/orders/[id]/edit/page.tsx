import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { OrderForm, blankOrderInitial } from "@/modules/orders/order-form";
import { getOrder, orderFormData } from "@/modules/orders/queries";
import { transportModeOptions } from "@/modules/transport/queries";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("orders");
  const [data, { accountOpts, carrierOpts }, transportOpts] = await Promise.all([
    getOrder(id),
    orderFormData(),
    transportModeOptions(),
  ]);
  if (!data) notFound();
  const o = data.order;

  const initial = {
    ...blankOrderInitial(),
    id: o.id,
    title: o.title,
    clientOrderId: o.clientOrderId ?? "",
    accountId: o.accountId,
    carrierId: o.carrierId ?? "",
    route: o.route ?? "",
    cargoDescription: o.cargoDescription ?? "",
    packages: o.packages != null ? String(o.packages) : "",
    weightKg: o.weightKg ?? "",
    volumeM3: o.volumeM3 ?? "",
    incoterms: o.incoterms ?? "",
    deliveryFormat: o.deliveryFormat ?? "",
    clientCharge: o.clientCharge ?? "",
    carrierCost: o.carrierCost ?? "",
    additionalCosts: o.additionalCosts ?? "",
    additionalCostsNote: o.additionalCostsNote ?? "",
    expectedProfit: o.expectedProfit ?? "",
    invoiceNumber: o.invoiceNumber ?? "",
    invoiceDate: o.invoiceDate ?? "",
    transportMode: (o.transportModeId ? "existing" : "none") as "existing" | "none",
    transportModeId: o.transportModeId ?? "",
  };

  return (
    <div>
      <PageHeader title={t("editOrder")} />
      <OrderForm initial={initial} accountOpts={accountOpts} carrierOpts={carrierOpts} transportOpts={transportOpts} />
    </div>
  );
}
