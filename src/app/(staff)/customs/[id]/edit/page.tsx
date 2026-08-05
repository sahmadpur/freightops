import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { CustomsForm } from "@/modules/customs/customs-form";
import {
  emptyCustomsItem,
  type CustomsFormInitial,
} from "@/modules/customs/customs-form-initial";
import { customsFormData, getCustomsClearance } from "@/modules/customs/queries";

export default async function EditCustomsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const [data, { accountOpts, orderOpts }] = await Promise.all([
    getCustomsClearance(id),
    customsFormData(),
  ]);
  if (!data) notFound();
  const c = data.clearance;

  const initial: CustomsFormInitial = {
    id: c.id,
    mode: c.orderId ? "order" : "standalone",
    orderId: c.orderId ?? "",
    accountId: c.accountId ?? "",
    declarationNumber: c.declarationNumber ?? "",
    description: c.description ?? "",
    currency: c.currency,
    exchangeRate: c.exchangeRate ?? "",
    clearedAt: c.clearedAt ?? "",
    notes: c.notes ?? "",
    items: data.items.length
      ? data.items.map((i) => ({
          category: i.category,
          buyAmount: i.buyAmount ?? "",
          sellAmount: i.sellAmount ?? "",
          note: i.note ?? "",
        }))
      : [emptyCustomsItem()],
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow={`${t("nav.customs")} · ${c.number}`} title={t("customs.editClearance")} />
      <CustomsForm initial={initial} accountOpts={accountOpts} orderOpts={orderOpts} />
    </div>
  );
}
