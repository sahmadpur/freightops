import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { OrderForm } from "@/modules/orders/order-form";
import { blankOrderInitial } from "@/modules/orders/order-form-initial";
import { orderFormData } from "@/modules/orders/queries";
import { getAznRate } from "@/modules/fx/queries";
import { DEFAULT_CURRENCY } from "@/lib/fx";

export default async function NewOrderPage() {
  const t = await getTranslations("orders");
  const tn = await getTranslations("nav");
  const today = new Date().toISOString().slice(0, 10);
  // Seed today's CBAR rate here rather than in an effect, so the form renders
  // pre-filled. The field stays editable and refetches if the currency changes.
  const [{ accountOpts, carrierOpts, staffOpts, cargoTypeOpts }, rate] = await Promise.all([
    orderFormData(),
    getAznRate(DEFAULT_CURRENCY, today),
  ]);
  const initial = { ...blankOrderInitial(), exchangeRate: rate ?? "" };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow={tn("orders")} title={t("newOrder")} />
      <OrderForm
        initial={initial}
        accountOpts={accountOpts}
        carrierOpts={carrierOpts}
        staffOpts={staffOpts}
        contactOpts={[]}
        cargoTypeOpts={cargoTypeOpts}
      />
    </div>
  );
}
