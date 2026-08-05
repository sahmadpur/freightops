import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { CustomsForm } from "@/modules/customs/customs-form";
import { blankCustomsInitial } from "@/modules/customs/customs-form-initial";
import { customsFormData } from "@/modules/customs/queries";
import { getAznRate } from "@/modules/fx/queries";
import { DEFAULT_CURRENCY } from "@/lib/fx";

export default async function NewCustomsPage() {
  const t = await getTranslations();
  const today = new Date().toISOString().slice(0, 10);
  const [{ accountOpts, orderOpts }, rate] = await Promise.all([
    customsFormData(),
    getAznRate(DEFAULT_CURRENCY, today),
  ]);
  const initial = { ...blankCustomsInitial(), exchangeRate: rate ?? "" };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow={t("nav.customs")} title={t("customs.newClearance")} />
      <CustomsForm initial={initial} accountOpts={accountOpts} orderOpts={orderOpts} />
    </div>
  );
}
