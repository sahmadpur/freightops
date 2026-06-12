import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { CarrierForm } from "@/modules/carriers/carrier-form";

export default async function NewCarrierPage() {
  const t = await getTranslations("carriers");
  return (
    <div>
      <PageHeader title={t("newCarrier")} />
      <CarrierForm initial={{ title: "", address: "", notes: "", contacts: [] }} />
    </div>
  );
}
