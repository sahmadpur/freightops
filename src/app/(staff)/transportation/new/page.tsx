import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { TransportForm } from "@/modules/transport/transport-form";

export default async function NewTransportPage() {
  const t = await getTranslations("transport");
  return (
    <div>
      <PageHeader title={t("newTransport")} />
      <TransportForm
        initial={{
          modeType: "vehicle",
          number: "",
          fromCountry: "",
          toCountry: "",
          route: "",
          loadingDate: "",
          plannedArrivalDate: "",
          totalWeightKg: "",
          totalVolumeM3: "",
        }}
      />
    </div>
  );
}
