import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { requireArea } from "@/lib/session";
import { toLocalInput } from "@/lib/datetime";
import { RequestForm } from "@/modules/requests/request-form";
import { contactOptions, getRequest, requestFormData } from "@/modules/requests/queries";
import { cargoDraft, legDrafts } from "@/modules/requests/shipment-drafts";

/** "" for every nullable column — the form holds strings throughout. */
const s = (v: string | null | undefined) => v ?? "";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea("staff");
  const { id } = await params;
  const [t, data, { accountOpts, agentOpts, staffOpts, cargoTypeOpts }] = await Promise.all([
    getTranslations("requests"),
    getRequest(id),
    requestFormData(),
  ]);
  if (!data) notFound();

  const r = data.request;
  const contactOpts = r.accountId ? await contactOptions(r.accountId) : [];

  const legs = legDrafts(data.legs);
  const cargo = cargoDraft(data.cargo);

  return (
    <div>
      <PageHeader eyebrow={r.number} title={t("editRequest")} />
      <RequestForm
        initial={{
          id: r.id,
          number: r.number,
          accountId: s(r.accountId),
          contactId: s(r.contactId),
          responsibleUserId: r.responsibleUserId,
          leadSource: r.leadSource,
          sourceAgentAccountId: s(r.sourceAgentAccountId),
          sourceNote: s(r.sourceNote),
          emailSubject: s(r.emailSubject),
          title: r.title,
          receivedAt: toLocalInput(r.receivedAt),
          transportFamily: s(r.transportFamily),
          incoterms: s(r.incoterms),
          incotermPlace: s(r.incotermPlace),
          cargoReadyDate: s(r.cargoReadyDate),
          requestedDeliveryDate: s(r.requestedDeliveryDate),
          specialInstructions: s(r.specialInstructions),
          legs,
          cargo,
        }}
        accountOpts={accountOpts}
        agentOpts={agentOpts}
        staffOpts={staffOpts}
        contactOpts={contactOpts}
        cargoTypeOpts={cargoTypeOpts}
      />
    </div>
  );
}
