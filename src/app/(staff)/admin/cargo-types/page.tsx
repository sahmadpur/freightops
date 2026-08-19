import { getTranslations } from "next-intl/server";
import { requireArea } from "@/lib/session";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { listCargoTypes } from "@/modules/admin/queries";
import { CargoTypesTable } from "@/modules/admin/cargo-types-table";

export default async function CargoTypesPage() {
  await requireArea("admin");
  const t = await getTranslations("admin");
  const rows = await listCargoTypes();

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-slate-900">{t("cargoTypesTitle")}</h1>
      <Card>
        <CardHeader>
          <span className="font-display text-[13px] font-bold tracking-[-0.01em] text-ink">
            {t("cargoTypesHint")}
          </span>
        </CardHeader>
        <CardBody>
          <CargoTypesTable rows={rows} />
        </CardBody>
      </Card>
    </div>
  );
}
