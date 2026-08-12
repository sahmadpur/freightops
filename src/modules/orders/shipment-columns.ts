import { isSubtypeOf, legacyModeFor, type LegTransportType } from "@/lib/transport-matrix";
import { emptyLeg, type LegDraft } from "@/modules/requests/request-form-initial";

/**
 * The order's denormalized shipment columns, derived from its legs and cargo.
 *
 * `transport_legs` / `cargo_details` are the truth (§26), but the order list,
 * the filters, the dashboard and the generated documents all read the flat
 * columns on `orders`. So the flat columns are computed here — never typed by
 * hand — and rewritten on every save. One definition, used by the order form
 * and by request→order conversion, so the two can never disagree.
 *
 * Inputs are deliberately loose: form drafts hold strings, database rows hold
 * numbers, and both are the same shipment.
 */

type LegLike = {
  transportType: string;
  subtype?: string | null;
  originCountry?: string | null;
  originCity?: string | null;
  destinationCountry?: string | null;
  destinationCity?: string | null;
};

type CargoLike = {
  description?: string | null;
  packages?: string | number | null;
  grossWeightKg?: string | number | null;
  volumeM3?: string | number | null;
} | null;

/** Leg subtypes that are also a delivery format. Others leave the column empty. */
const DELIVERY_FORMAT: Record<string, "FTL" | "LTL" | "FCL" | "LCL"> = {
  ftl: "FTL",
  ltl: "LTL",
  fcl: "FCL",
  lcl: "LCL",
};

const text = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);
const decimal = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? null : String(v);
const count = (v: string | number | null | undefined) => {
  const s = decimal(v);
  return s === null ? null : Number(s);
};

/**
 * The reverse bridge, for orders created before transport was structured: turn
 * the flat columns back into one leg so the form can edit them. Saving then
 * writes real leg and cargo rows, so an order passes through this once.
 *
 * ponytail: `container` and `postal` have no leg equivalent — they are leftovers
 * of the pre-specification vocabulary — so they seed no leg and the desk picks
 * the transport type by hand. Drop this function once no order lacks legs.
 */
const LEG_TYPE_FROM_LEGACY: Record<string, LegTransportType> = {
  truck: "road",
  sea: "sea",
  rail: "rail",
  air: "air",
};

export function legacyLegDraft(order: {
  transportType: string | null;
  fromCountry: string | null;
  fromCity: string | null;
  toCountry: string | null;
  toCity: string | null;
  deliveryFormat: string | null;
}): LegDraft | null {
  const type = order.transportType ? LEG_TYPE_FROM_LEGACY[order.transportType] : undefined;
  if (!type) return null;
  const subtype = order.deliveryFormat?.toLowerCase() ?? "";
  return {
    ...emptyLeg(type),
    subtype: isSubtypeOf(type, subtype) ? subtype : "",
    originCountry: order.fromCountry ?? "",
    originCity: order.fromCity ?? "",
    destinationCountry: order.toCountry ?? "",
    destinationCity: order.toCity ?? "",
  };
}

export function shipmentColumns(legs: LegLike[], cargo: CargoLike) {
  const first = legs[0];
  const last = legs[legs.length - 1];
  const subtype = text(first?.subtype);
  return {
    // A multimodal shipment is typed by the leg it starts in.
    transportType: legacyModeFor(
      legs.length > 1 ? "multimodal" : (first?.transportType ?? null),
      first?.transportType ?? null,
    ),
    fromCountry: text(first?.originCountry),
    fromCity: text(first?.originCity),
    toCountry: text(last?.destinationCountry),
    toCity: text(last?.destinationCity),
    deliveryFormat: subtype ? (DELIVERY_FORMAT[subtype] ?? null) : null,
    // The cargo description is one label here, the multi-select the order list
    // renders. Nothing else writes this column any more.
    cargoItems: text(cargo?.description) ? [text(cargo?.description)!] : [],
    packages: count(cargo?.packages),
    weightKg: decimal(cargo?.grossWeightKg),
    volumeM3: decimal(cargo?.volumeM3),
  };
}
