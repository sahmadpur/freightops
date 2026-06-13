import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { TransportForm } from "@/modules/transport/transport-form";
import { getTransportMode } from "@/modules/transport/queries";

export default async function EditTransportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("transport");
  const data = await getTransportMode(id);
  if (!data) notFound();
  const m = data.mode;

  return (
    <div>
      <PageHeader title={t("editTransport")} />
      <TransportForm
        initial={{
          id: m.id,
          modeType: m.modeType,
          number: m.number,
          fromCountry: m.fromCountry ?? "",
          toCountry: m.toCountry ?? "",
          route: m.route ?? "",
          loadingDate: m.loadingDate ?? "",
          plannedArrivalDate: m.plannedArrivalDate ?? "",
          totalWeightKg: m.totalWeightKg ?? "",
          totalVolumeM3: m.totalVolumeM3 ?? "",
        }}
      />
    </div>
  );
}
