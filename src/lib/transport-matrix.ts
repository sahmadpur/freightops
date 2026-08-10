/**
 * The dynamic-transport-field matrix (specification §8 and Appendix A).
 *
 * This is the single source of truth for both halves of the feature: the
 * pgEnums in `src/db/schema/domain.ts` are built from these lists, and the
 * request form asks `legFields()` which inputs to render. Neither can drift
 * from the other, and nothing here imports drizzle, so the form can use it in
 * the browser bundle. Labels live in the i18n namespaces named after each list.
 */

/** What the user picks at the top of a request. `multimodal` means "several legs". */
export const TRANSPORT_FAMILIES = ["road", "sea", "rail", "air", "multimodal"] as const;
export type TransportFamily = (typeof TRANSPORT_FAMILIES)[number];

/** What a single leg can be. A leg is never itself multimodal. */
export const LEG_TRANSPORT_TYPES = ["road", "sea", "rail", "air"] as const;
export type LegTransportType = (typeof LEG_TRANSPORT_TYPES)[number];

export function isLegTransportType(v: string): v is LegTransportType {
  return (LEG_TRANSPORT_TYPES as readonly string[]).includes(v);
}

export const TRANSPORT_SUBTYPES = [
  "ftl",
  "ltl",
  "fcl",
  "lcl",
  "breakbulk",
  "roro",
  "rail_container",
  "wagon",
  "rail_lcl",
] as const;
export type TransportSubtype = (typeof TRANSPORT_SUBTYPES)[number];

/** Air takes no subtype — the empty list is meaningful, not an omission. */
export const SUBTYPES_BY_FAMILY = {
  road: ["ftl", "ltl"],
  sea: ["fcl", "lcl", "breakbulk", "roro"],
  rail: ["rail_container", "wagon", "rail_lcl"],
  air: [],
} as const satisfies Record<LegTransportType, readonly TransportSubtype[]>;

export function subtypesFor(type: LegTransportType): readonly TransportSubtype[] {
  return SUBTYPES_BY_FAMILY[type];
}

/** True when `subtype` is one this transport type actually offers. */
export function isSubtypeOf(type: LegTransportType, subtype: string): boolean {
  return (SUBTYPES_BY_FAMILY[type] as readonly string[]).includes(subtype);
}

export const VEHICLE_TYPES = [
  "curtainsider",
  "reefer",
  "mega",
  "box",
  "container_chassis",
  "isothermal",
  "lowbed",
  "other",
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const CONTAINER_TYPES = [
  "20dc",
  "40dc",
  "40hc",
  "45hc",
  "20rf",
  "40rf",
  "open_top",
  "flat_rack",
  "other",
] as const;
export type ContainerType = (typeof CONTAINER_TYPES)[number];

/** Rail offers a narrower range than sea — no reefer or special-purpose boxes (§8.3). */
export const RAIL_CONTAINER_TYPES = [
  "20dc",
  "40dc",
  "40hc",
  "45hc",
  "other",
] as const satisfies readonly ContainerType[];

export const WAGON_TYPES = [
  "covered",
  "gondola",
  "platform",
  "tank",
  "hopper",
  "refrigerated",
  "other",
] as const;
export type WagonType = (typeof WAGON_TYPES)[number];

export const ROUTING_PREFERENCES = ["direct", "transit", "none"] as const;
export type RoutingPreference = (typeof ROUTING_PREFERENCES)[number];

/** Tri-state: "unknown" is a real answer from the client, not a missing value. */
export const STACKABLE_VALUES = ["yes", "no", "unknown"] as const;
export type Stackable = (typeof STACKABLE_VALUES)[number];

/**
 * What the origin/destination "point" column means for a given transport type:
 * a sea leg's points are POL/POD, a rail leg's are stations, an air leg's are
 * airports. Road legs have no point beyond the city. Drives both the label and
 * whether the input is rendered at all.
 */
export type PointKind = "port" | "station" | "airport";

/** Which equipment inputs a leg opens. The cargo block (§9) is always shown. */
export type LegFieldSet = {
  vehicle: boolean;
  containers: boolean;
  /** Containers on rail come from the narrower list. */
  containerOptions: readonly ContainerType[];
  wagons: boolean;
  /** Ro-Ro: a free-text vehicle/equipment description plus a quantity. */
  equipment: boolean;
  /** Air: chargeable weight, volumetric divisor, routing preference. */
  air: boolean;
  pointKind: PointKind | null;
};

const NO_FIELDS: LegFieldSet = {
  vehicle: false,
  containers: false,
  containerOptions: CONTAINER_TYPES,
  wagons: false,
  equipment: false,
  air: false,
  pointKind: null,
};

/**
 * The Appendix A row for one leg. `subtype` may be empty while the user is
 * still choosing; the shared fields for the transport type are returned either
 * way so the form never flickers between states.
 */
export function legFields(type: LegTransportType, subtype: string): LegFieldSet {
  switch (type) {
    case "road":
      return { ...NO_FIELDS, vehicle: subtype === "ftl" };
    case "sea":
      return {
        ...NO_FIELDS,
        pointKind: "port",
        containers: subtype === "fcl",
        equipment: subtype === "roro",
      };
    case "rail":
      return {
        ...NO_FIELDS,
        pointKind: "station",
        containers: subtype === "rail_container",
        containerOptions: RAIL_CONTAINER_TYPES,
        wagons: subtype === "wagon",
      };
    case "air":
      return { ...NO_FIELDS, pointKind: "airport", air: true };
  }
}

/**
 * Bridge to the older `mode_type` vocabulary that `orders.transport_type` still
 * uses — the column the order list, filters and dashboard ranking read.
 *
 * The two vocabularies coexist deliberately: the legs carry the specification's
 * model, while the order keeps one denormalized type so nothing downstream had
 * to be rewritten. A multimodal shipment is typed by its first leg, since that
 * is the mode the desk thinks of it as starting in.
 */
const LEGACY_MODE: Record<LegTransportType, "truck" | "sea" | "rail" | "air"> = {
  road: "truck",
  sea: "sea",
  rail: "rail",
  air: "air",
};

export function legacyModeFor(
  family: string | null,
  firstLegType: string | null,
): "truck" | "sea" | "rail" | "air" | null {
  const source = family === "multimodal" ? firstLegType : family;
  if (!source || !isLegTransportType(source)) return null;
  return LEGACY_MODE[source];
}

/**
 * Volumetric divisor used to derive chargeable weight from volume, in cm³/kg.
 * 6000 is the IATA default; the field is editable because forwarders negotiate
 * their own coefficient (§8.4).
 */
export const DEFAULT_VOLUMETRIC_DIVISOR = 6000;

/**
 * Chargeable weight = max(gross weight, volume ÷ divisor). `volumeM3` is in m³
 * and the divisor in cm³/kg, hence the 1 000 000 factor. Returns null when
 * neither input is known.
 */
export function chargeableWeight(
  grossKg: number | null,
  volumeM3: number | null,
  divisor: number = DEFAULT_VOLUMETRIC_DIVISOR,
): number | null {
  if (grossKg === null && volumeM3 === null) return null;
  const volumetric = volumeM3 !== null && divisor > 0 ? (volumeM3 * 1_000_000) / divisor : 0;
  return Math.max(grossKg ?? 0, volumetric);
}
