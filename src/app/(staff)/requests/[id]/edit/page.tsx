import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { requireArea } from "@/lib/session";
import { toLocalInput } from "@/lib/datetime";
import { RequestForm } from "@/modules/requests/request-form";
import { emptyCargo, type LegDraft } from "@/modules/requests/request-form-initial";
import { contactOptions, getRequest, requestFormData } from "@/modules/requests/queries";
import type { LegTransportType } from "@/lib/transport-matrix";

/** "" for every nullable column — the form holds strings throughout. */
const s = (v: string | null | undefined) => v ?? "";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea("staff");
  const { id } = await params;
  const [t, data, { accountOpts, agentOpts, staffOpts }] = await Promise.all([
    getTranslations("requests"),
    getRequest(id),
    requestFormData(),
  ]);
  if (!data) notFound();

  const r = data.request;
  const contactOpts = r.accountId ? await contactOptions(r.accountId) : [];

  const legs: LegDraft[] = data.legs.map((l) => ({
    transportType: l.transportType as LegTransportType,
    subtype: s(l.subtype),
    originCountry: s(l.originCountry),
    originCity: s(l.originCity),
    originPoint: s(l.originPoint),
    destinationCountry: s(l.destinationCountry),
    destinationCity: s(l.destinationCity),
    destinationPoint: s(l.destinationPoint),
    vehicleType: s(l.vehicleType),
    vehicleCount: l.vehicleCount === null ? "" : String(l.vehicleCount),
    containerType: s(l.containerType),
    containerCount: l.containerCount === null ? "" : String(l.containerCount),
    wagonType: s(l.wagonType),
    wagonCount: l.wagonCount === null ? "" : String(l.wagonCount),
    equipmentDescription: s(l.equipmentDescription),
    equipmentCount: l.equipmentCount === null ? "" : String(l.equipmentCount),
    chargeableWeightKg: s(l.chargeableWeightKg),
    volumetricDivisor: l.volumetricDivisor === null ? "" : String(l.volumetricDivisor),
    routingPreference: s(l.routingPreference),
    notes: s(l.notes),
  }));

  const c = data.cargo;
  const cargo = c
    ? {
        description: s(c.description),
        hsCodes: c.hsCodes,
        packages: c.packages === null ? "" : String(c.packages),
        grossWeightKg: s(c.grossWeightKg),
        volumeM3: s(c.volumeM3),
        dimensions: c.dimensions.map((d) => ({
          lengthCm: String(d.lengthCm),
          widthCm: String(d.widthCm),
          heightCm: String(d.heightCm),
          quantity: String(d.quantity),
        })),
        cargoValue: s(c.cargoValue),
        cargoCurrency: s(c.cargoCurrency),
        stackable: s(c.stackable),
        dangerousGoods: c.dangerousGoods,
        dgClass: s(c.dgClass),
        unNumber: s(c.unNumber),
        dgNotes: s(c.dgNotes),
        temperatureControlled: c.temperatureControlled,
        tempMinC: s(c.tempMinC),
        tempMaxC: s(c.tempMaxC),
        oversized: c.oversized,
        oversizedNotes: s(c.oversizedNotes),
      }
    : emptyCargo();

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
      />
    </div>
  );
}
