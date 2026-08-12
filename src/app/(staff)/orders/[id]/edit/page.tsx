import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/db";
import { OrderForm } from "@/modules/orders/order-form";
import { blankOrderInitial } from "@/modules/orders/order-form-initial";
import { legacyLegDraft } from "@/modules/orders/shipment-columns";
import { getOrder, orderFormData } from "@/modules/orders/queries";
import { readCargo, readLegs } from "@/modules/requests/shipment";
import { cargoDraft, familyOf, legDrafts } from "@/modules/requests/shipment-drafts";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("orders");
  const tn = await getTranslations("nav");
  const [data, { accountOpts, carrierOpts }, legRows, cargoRow] = await Promise.all([
    getOrder(id),
    orderFormData(),
    readLegs(db, "order", id),
    readCargo(db, "order", id),
  ]);
  if (!data) notFound();
  const o = data.order;

  // An order converted from a request already has its legs. One typed in before
  // transport was structured has only the flat columns — seed a leg from them so
  // nothing is lost, and saving stores it properly from then on.
  const seeded = legRows.length === 0 ? legacyLegDraft(o) : null;
  const legs = seeded ? [seeded] : legDrafts(legRows);
  const cargo = cargoRow
    ? cargoDraft(cargoRow)
    : {
        ...cargoDraft(null),
        description: o.cargoItems.join(", "),
        packages: o.packages != null ? String(o.packages) : "",
        grossWeightKg: o.weightKg ?? "",
        volumeM3: o.volumeM3 ?? "",
      };

  // Money (charge and agent expenses) is absent on edit: it is managed as
  // finance lines in the order's Finance tab so the rollups can't drift.
  const initial = {
    ...blankOrderInitial(),
    id: o.id,
    accountId: o.accountId,
    carrierId: o.carrierId ?? "",
    title: o.title,
    rollbackNumber: o.rollbackNumber ?? "",
    transportFamily: seeded ? seeded.transportType : familyOf(legRows),
    legs,
    cargo,
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
