import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArchiveButton } from "@/components/ui/archive-button";
import { DefRow, SectionRule } from "@/components/ui/record";
import { EntityHistory } from "@/components/entity-history";
import { DocumentsTab } from "@/modules/documents/documents-tab";
import { listRequestDocuments } from "@/modules/documents/queries";
import { requireArea } from "@/lib/session";
import { countryLabel } from "@/lib/countries";
import { formatDateTime } from "@/lib/datetime";
import { legFields, type LegTransportType, type PointKind } from "@/lib/transport-matrix";
import { QuotationTab } from "@/modules/quotations/quotation-tab";
import { CommunicationTab } from "@/modules/communications/communication-tab";
import { listRequestMessages } from "@/modules/communications/queries";
import { listQuotations } from "@/modules/quotations/queries";
import { isClosedRequestStatus, type RequestStatus } from "@/lib/request-status";
import { archiveRequest, restoreRequest } from "@/modules/requests/actions";
import { getRequest } from "@/modules/requests/queries";
import { RequestDetailTabs } from "@/modules/requests/request-detail-tabs";
import { RequestStatusControl } from "@/modules/requests/request-status-control";
import { ConvertControl } from "@/modules/requests/convert-control";
import { carrierPickerOptions } from "@/modules/carriers/queries";

const POINT_LABELS: Record<PointKind, { origin: string; destination: string }> = {
  port: { origin: "portOfLoading", destination: "portOfDischarge" },
  station: { origin: "originStation", destination: "destinationStation" },
  airport: { origin: "originAirport", destination: "destinationAirport" },
};

const dl = "grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3 lg:grid-cols-4";

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireArea("staff");
  const { id } = await params;
  const { tab } = await searchParams;
  const [t, locale, data] = await Promise.all([getTranslations(), getLocale(), getRequest(id)]);
  if (!data) notFound();

  const r = data.request;
  const [documents, quotations, carrierOpts, messages] = await Promise.all([
    listRequestDocuments(id),
    listQuotations(id),
    carrierPickerOptions(),
    listRequestMessages(id),
  ]);
  // A decided request keeps its commercial record, but read-only: the numbers
  // the client saw are what the KPIs are computed from.
  const decided = isClosedRequestStatus(r.status as RequestStatus);

  const place = (city: string | null, country: string | null) =>
    [city, countryLabel(country, locale)].filter(Boolean).join(", ") || null;

  const overview = (
    <div className="space-y-7">
      <section>
        <SectionRule>{t("requests.sectionEnquiry")}</SectionRule>
        <dl className={dl}>
          <DefRow label={t("fields.client")} value={data.accountTitle} />
          <DefRow label={t("fields.contactPerson")} value={data.contact?.name} />
          <DefRow label={t("fields.responsibleManager")} value={data.responsibleName} />
          <DefRow label={t("fields.leadSource")} value={t(`leadSource.${r.leadSource}`)} />
          <DefRow label={t("fields.receivedAt")} value={formatDateTime(r.receivedAt, locale)} />
          <DefRow label={t("fields.createdAt")} value={formatDateTime(r.createdAt, locale)} />
          {data.sourceAgentTitle && (
            <DefRow label={t("fields.sourceAgent")} value={data.sourceAgentTitle} />
          )}
          {r.emailSubject && <DefRow label={t("fields.emailSubject")} value={r.emailSubject} />}
          {r.sourceNote && (
            <DefRow label={t("fields.sourceNote")} value={r.sourceNote} className="col-span-full" />
          )}
        </dl>
      </section>

      <section>
        <SectionRule>{t("requests.sectionRoute")}</SectionRule>
        {data.legs.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("requests.noLegs")}</p>
        ) : (
          <div className="space-y-5">
            {data.legs.map((leg) => {
              const fields = legFields(leg.transportType as LegTransportType, leg.subtype ?? "");
              return (
                <dl key={leg.id} className={dl}>
                  {/* The leg number only earns its place when there is more than one. */}
                  {data.legs.length > 1 && (
                    <DefRow label={t("fields.leg")} value={String(leg.legNumber)} />
                  )}
                  <DefRow
                    label={t("fields.transportType")}
                    value={[
                      t(`transportFamily.${leg.transportType}`),
                      leg.subtype ? t(`transportSubtype.${leg.subtype}`) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <DefRow label={t("fields.originCountry")} value={place(leg.originCity, leg.originCountry)} />
                  <DefRow
                    label={t("fields.destinationCountry")}
                    value={place(leg.destinationCity, leg.destinationCountry)}
                  />
                  {fields.pointKind && (
                    <>
                      <DefRow label={t(`fields.${POINT_LABELS[fields.pointKind].origin}`)} value={leg.originPoint} />
                      <DefRow
                        label={t(`fields.${POINT_LABELS[fields.pointKind].destination}`)}
                        value={leg.destinationPoint}
                      />
                    </>
                  )}
                  {fields.vehicle && (
                    <>
                      <DefRow
                        label={t("fields.vehicleType")}
                        value={leg.vehicleType ? t(`vehicleType.${leg.vehicleType}`) : null}
                      />
                      <DefRow label={t("fields.numberOfTrucks")} value={leg.vehicleCount} />
                    </>
                  )}
                  {fields.containers && (
                    <>
                      <DefRow
                        label={t("fields.containerType")}
                        value={leg.containerType ? t(`containerType.${leg.containerType}`) : null}
                      />
                      <DefRow label={t("fields.containerQuantity")} value={leg.containerCount} />
                    </>
                  )}
                  {fields.wagons && (
                    <>
                      <DefRow
                        label={t("fields.wagonType")}
                        value={leg.wagonType ? t(`wagonType.${leg.wagonType}`) : null}
                      />
                      <DefRow label={t("fields.numberOfWagons")} value={leg.wagonCount} />
                    </>
                  )}
                  {fields.equipment && (
                    <>
                      <DefRow label={t("fields.equipmentDescription")} value={leg.equipmentDescription} />
                      <DefRow label={t("fields.equipmentQuantity")} value={leg.equipmentCount} />
                    </>
                  )}
                  {fields.air && (
                    <>
                      <DefRow label={t("fields.chargeableWeight")} value={leg.chargeableWeightKg} />
                      <DefRow
                        label={t("fields.routingPreference")}
                        value={leg.routingPreference ? t(`routingPreference.${leg.routingPreference}`) : null}
                      />
                    </>
                  )}
                  {leg.notes && <DefRow label={t("fields.notes")} value={leg.notes} className="col-span-full" />}
                </dl>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionRule>{t("requests.sectionCargo")}</SectionRule>
        <dl className={dl}>
          <DefRow
            label={t("fields.cargoDescription")}
            value={data.cargo?.description}
            className="col-span-full"
          />
          <DefRow label={t("fields.hsCode")} value={data.cargo?.hsCodes.join(", ")} />
          <DefRow label={t("fields.packages")} value={data.cargo?.packages} />
          <DefRow label={t("fields.grossWeight")} value={data.cargo?.grossWeightKg} />
          <DefRow label={t("fields.volumeM3")} value={data.cargo?.volumeM3} />
          <DefRow
            label={t("fields.cargoValue")}
            value={
              data.cargo?.cargoValue
                ? `${data.cargo.cargoValue} ${data.cargo.cargoCurrency ?? ""}`.trim()
                : null
            }
          />
          <DefRow
            label={t("fields.stackable")}
            value={data.cargo?.stackable ? t(`stackable.${data.cargo.stackable}`) : null}
          />
          {data.cargo && data.cargo.dimensions.length > 0 && (
            <DefRow
              label={t("fields.dimensions")}
              value={data.cargo.dimensions
                .map((d) => `${d.lengthCm}×${d.widthCm}×${d.heightCm} ×${d.quantity}`)
                .join("; ")}
              className="col-span-full"
            />
          )}
          {data.cargo?.dangerousGoods && (
            <>
              <DefRow label={t("fields.dgClass")} value={data.cargo.dgClass} />
              <DefRow label={t("fields.unNumber")} value={data.cargo.unNumber} />
              <DefRow label={t("fields.dgNotes")} value={data.cargo.dgNotes} />
            </>
          )}
          {data.cargo?.temperatureControlled && (
            <>
              <DefRow label={t("fields.tempMin")} value={data.cargo.tempMinC} />
              <DefRow label={t("fields.tempMax")} value={data.cargo.tempMaxC} />
            </>
          )}
          {data.cargo?.oversized && (
            <DefRow label={t("fields.oversizedNotes")} value={data.cargo.oversizedNotes} />
          )}
        </dl>
      </section>

      <section>
        <SectionRule>{t("requests.sectionTerms")}</SectionRule>
        <dl className={dl}>
          <DefRow
            label={t("fields.incoterms")}
            value={[r.incoterms, r.incotermPlace].filter(Boolean).join(" ")}
          />
          <DefRow label={t("fields.cargoReadyDate")} value={r.cargoReadyDate} />
          <DefRow label={t("fields.requestedDeliveryDate")} value={r.requestedDeliveryDate} />
          <DefRow
            label={t("fields.specialInstructions")}
            value={r.specialInstructions}
            className="col-span-full"
          />
        </dl>
      </section>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow={r.number}
        title={r.title}
        action={
          <div className="flex items-center gap-3">
            <Link href={`/requests/${r.id}/edit`} className="btn-secondary">
              {t("actions.edit")}
            </Link>
            {r.deletedAt ? (
              <ArchiveButton mode="restore" label={t("actions.restore")} action={restoreRequest.bind(null, r.id)} />
            ) : (
              <ArchiveButton
                mode="archive"
                label={t("actions.archive")}
                confirm={t("actions.confirmArchive")}
                hasOrdersError={t("requests.hasOrder")}
                redirectTo="/requests"
                action={archiveRequest.bind(null, r.id)}
              />
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <RequestDetailTabs
            initialTab={tab}
            overview={overview}
            quotation={<QuotationTab requestId={r.id} versions={quotations} readOnly={decided} />}
            emails={<CommunicationTab requestId={r.id} messages={messages} />}
            documents={<DocumentsTab orderId={r.id} parentType="request" documents={documents} />}
            history={
              <EntityHistory
                entries={data.history}
                title={t("requests.tabHistory")}
                empty={t("orders.noHistory")}
              />
            }
          />
        </div>

        <aside className="w-full shrink-0 space-y-5 lg:sticky lg:top-6 lg:h-fit lg:w-80">
          <div>
            <SectionRule>{t("fields.status")}</SectionRule>
            <div className="mb-3">
              <StatusBadge status={r.status} />
            </div>
            <RequestStatusControl
              requestId={r.id}
              current={r.status}
              lostReason={r.lostReason}
              lostReasonNote={r.lostReasonNote}
            />
            {r.lostReason && (
              <dl className="mt-3">
                <DefRow label={t("fields.lostReason")} value={t(`lostReason.${r.lostReason}`)} />
                {r.lostReasonNote && (
                  <DefRow label={t("fields.lostReasonNote")} value={r.lostReasonNote} />
                )}
              </dl>
            )}
          </div>

          <div>
            <SectionRule>{t("requests.linkedOrder")}</SectionRule>
            {r.orderId && data.orderNumber ? (
              <Link href={`/orders/${r.orderId}`} className="text-[13px] font-medium text-brand hover:underline">
                {data.orderNumber}
              </Link>
            ) : (
              // Available from any undecided status: a client can confirm at any
              // point, including before a quotation was ever sent (§2 path B).
              !decided && (
                <ConvertControl
                  requestId={r.id}
                  hasQuotation={quotations.length > 0}
                  carrierOpts={carrierOpts}
                />
              )
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
