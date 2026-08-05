import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { OrderForm } from "@/modules/orders/order-form";
import { blankOrderInitial } from "@/modules/orders/order-form-initial";
import { getOrder, orderFormData } from "@/modules/orders/queries";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("orders");
  const tn = await getTranslations("nav");
  const [data, { accountOpts, carrierOpts }] = await Promise.all([getOrder(id), orderFormData()]);
  if (!data) notFound();
  const o = data.order;

  // Money (charge and agent expenses) is absent on edit: it is managed as
  // finance lines in the order's Finance tab so the rollups can't drift.
  const initial = {
    ...blankOrderInitial(),
    id: o.id,
    transportType: o.transportType ?? "",
    accountId: o.accountId,
    carrierId: o.carrierId ?? "",
    fromCountry: o.fromCountry ?? "",
    toCountry: o.toCountry ?? "",
    title: o.title,
    rollbackNumber: o.rollbackNumber ?? "",
    deliveryFormat: o.deliveryFormat ?? "",
    cargoItems: o.cargoItems,
    packages: o.packages != null ? String(o.packages) : "",
    weightKg: o.weightKg ?? "",
    volumeM3: o.volumeM3 ?? "",
    incoterms: o.incoterms ?? "",
    currency: o.currency,
    exchangeRate: o.exchangeRate ?? "",
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow={tn("orders")} title={t("editOrder")} />
      <OrderForm initial={initial} accountOpts={accountOpts} carrierOpts={carrierOpts} />
    </div>
  );
}
