import { getLocale, getTranslations } from "next-intl/server";
import { DefRow, SectionRule } from "@/components/ui/record";
import { countryLabel } from "@/lib/countries";
import { legFields, type LegTransportType, type PointKind } from "@/lib/transport-matrix";
import type { CargoRow, LegRow } from "./shipment";

/**
 * Route and cargo, read-only. Requests and orders carry the same shipment
 * payload (§14 copies it across), so both detail pages render it through here
 * rather than each growing its own copy of Appendix A's field matrix.
 */

const POINT_LABELS: Record<PointKind, { origin: string; destination: string }> = {
  port: { origin: "portOfLoading", destination: "portOfDischarge" },
  station: { origin: "originStation", destination: "destinationStation" },
  airport: { origin: "originAirport", destination: "destinationAirport" },
};

const dl = "grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3 lg:grid-cols-4";

export async function ShipmentView({ legs, cargo }: { legs: LegRow[]; cargo: CargoRow | null }) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);

  const place = (city: string | null, country: string | null) =>
    [city, countryLabel(country, locale)].filter(Boolean).join(", ") || null;

  return (
    <>
      <section>
        <SectionRule>{t("requests.sectionRoute")}</SectionRule>
        {legs.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("requests.noLegs")}</p>
        ) : (
          <div className="space-y-5">
            {legs.map((leg) => {
              const fields = legFields(leg.transportType as LegTransportType, leg.subtype ?? "");
              return (
                <dl key={leg.id} className={dl}>
                  {/* The leg number only earns its place when there is more than one. */}
                  {legs.length > 1 && <DefRow label={t("fields.leg")} value={String(leg.legNumber)} />}
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
          <DefRow label={t("fields.cargoDescription")} value={cargo?.description} className="col-span-full" />
          <DefRow label={t("fields.hsCode")} value={cargo?.hsCodes.join(", ")} />
          <DefRow label={t("fields.packages")} value={cargo?.packages} />
          <DefRow label={t("fields.grossWeight")} value={cargo?.grossWeightKg} />
          <DefRow label={t("fields.volumeM3")} value={cargo?.volumeM3} />
          <DefRow
            label={t("fields.cargoValue")}
            value={cargo?.cargoValue ? `${cargo.cargoValue} ${cargo.cargoCurrency ?? ""}`.trim() : null}
          />
          <DefRow
            label={t("fields.stackable")}
            value={cargo?.stackable ? t(`stackable.${cargo.stackable}`) : null}
          />
          {cargo && cargo.dimensions.length > 0 && (
            <DefRow
              label={t("fields.dimensions")}
              value={cargo.dimensions
                .map((d) => `${d.lengthCm}×${d.widthCm}×${d.heightCm} ×${d.quantity}`)
                .join("; ")}
              className="col-span-full"
            />
          )}
          {cargo?.dangerousGoods && (
            <>
              <DefRow label={t("fields.dgClass")} value={cargo.dgClass} />
              <DefRow label={t("fields.unNumber")} value={cargo.unNumber} />
              <DefRow label={t("fields.dgNotes")} value={cargo.dgNotes} />
            </>
          )}
          {cargo?.temperatureControlled && (
            <>
              <DefRow label={t("fields.tempMin")} value={cargo.tempMinC} />
              <DefRow label={t("fields.tempMax")} value={cargo.tempMaxC} />
            </>
          )}
          {cargo?.oversized && <DefRow label={t("fields.oversizedNotes")} value={cargo.oversizedNotes} />}
        </dl>
      </section>
    </>
  );
}
