import type { LegTransportType } from "@/lib/transport-matrix";
import { emptyCargo, type CargoDraft, type LegDraft } from "./request-form-initial";
import type { CargoRow, LegRow } from "./shipment";

/**
 * Database rows → form drafts. The forms hold every value as a string, so this
 * is where nulls and numbers become "". Requests and orders edit the same
 * shipment, so both edit pages come through here.
 */

/** "" for every nullable column. */
const s = (v: string | null | undefined) => v ?? "";
const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function legDrafts(rows: LegRow[]): LegDraft[] {
  return rows.map((l) => ({
    transportType: l.transportType as LegTransportType,
    subtype: s(l.subtype),
    originCountry: s(l.originCountry),
    originCity: s(l.originCity),
    originPoint: s(l.originPoint),
    destinationCountry: s(l.destinationCountry),
    destinationCity: s(l.destinationCity),
    destinationPoint: s(l.destinationPoint),
    vehicleType: s(l.vehicleType),
    vehicleCount: n(l.vehicleCount),
    containerType: s(l.containerType),
    containerCount: n(l.containerCount),
    wagonType: s(l.wagonType),
    wagonCount: n(l.wagonCount),
    equipmentDescription: s(l.equipmentDescription),
    equipmentCount: n(l.equipmentCount),
    chargeableWeightKg: s(l.chargeableWeightKg),
    volumetricDivisor: n(l.volumetricDivisor),
    routingPreference: s(l.routingPreference),
    notes: s(l.notes),
  }));
}

export function cargoDraft(c: CargoRow | null): CargoDraft {
  if (!c) return emptyCargo();
  return {
    description: s(c.description),
    hsCodes: c.hsCodes,
    packages: n(c.packages),
    packagingType: s(c.packagingType),
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
  };
}

/** "multimodal" once a shipment has more than one leg; otherwise the leg's own type. */
export function familyOf(rows: LegRow[]): string {
  if (rows.length > 1) return "multimodal";
  return rows[0]?.transportType ?? "";
}
