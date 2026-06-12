import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { CarrierForm } from "@/modules/carriers/carrier-form";
import { getCarrier } from "@/modules/carriers/queries";

export default async function EditCarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("carriers");
  const data = await getCarrier(id);
  if (!data) notFound();

  return (
    <div>
      <PageHeader title={t("editCarrier")} />
      <CarrierForm
        initial={{
          id: data.carrier.id,
          title: data.carrier.title,
          address: data.carrier.address ?? "",
          notes: data.carrier.notes ?? "",
          contacts: data.contacts.map((c) => ({
            name: c.name,
            phones: c.phones.length ? c.phones : [""],
            emails: c.emails.length ? c.emails : [""],
          })),
        }}
      />
    </div>
  );
}
