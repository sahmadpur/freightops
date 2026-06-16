import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { OrderForm } from "@/modules/orders/order-form";
import { blankOrderInitial } from "@/modules/orders/order-form-initial";
import { orderFormData } from "@/modules/orders/queries";
import { transportModeOptions } from "@/modules/transport/queries";

export default async function NewOrderPage() {
  const t = await getTranslations("orders");
  const tn = await getTranslations("nav");
  const [{ accountOpts, carrierOpts }, transportOpts] = await Promise.all([
    orderFormData(),
    transportModeOptions(),
  ]);
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow={tn("orders")} title={t("newOrder")} />
      <OrderForm initial={blankOrderInitial()} accountOpts={accountOpts} carrierOpts={carrierOpts} transportOpts={transportOpts} />
    </div>
  );
}
