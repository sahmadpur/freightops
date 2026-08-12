import { isLegTransportType, type LegTransportType } from "@/lib/transport-matrix";

/** One leg as the form holds it — every value a string, matching the house style. */
export type LegDraft = {
  transportType: LegTransportType;
  subtype: string;
  originCountry: string;
  originCity: string;
  originPoint: string;
  destinationCountry: string;
  destinationCity: string;
  destinationPoint: string;
  vehicleType: string;
  vehicleCount: string;
  containerType: string;
  containerCount: string;
  wagonType: string;
  wagonCount: string;
  equipmentDescription: string;
  equipmentCount: string;
  chargeableWeightKg: string;
  volumetricDivisor: string;
  routingPreference: string;
  notes: string;
};

export type DimensionDraft = {
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  quantity: string;
};

export type CargoDraft = {
  description: string;
  hsCodes: string[];
  packages: string;
  grossWeightKg: string;
  volumeM3: string;
  dimensions: DimensionDraft[];
  cargoValue: string;
  cargoCurrency: string;
  stackable: string;
  dangerousGoods: boolean;
  dgClass: string;
  unNumber: string;
  dgNotes: string;
  temperatureControlled: boolean;
  tempMinC: string;
  tempMaxC: string;
  oversized: boolean;
  oversizedNotes: string;
};

export type RequestFormInitial = {
  id?: string;
  number?: string;
  accountId: string;
  contactId: string;
  responsibleUserId: string;
  leadSource: string;
  sourceAgentAccountId: string;
  sourceNote: string;
  emailSubject: string;
  title: string;
  /** `datetime-local` value in the desk's timezone; converted on submit. */
  receivedAt: string;
  transportFamily: string;
  incoterms: string;
  incotermPlace: string;
  cargoReadyDate: string;
  requestedDeliveryDate: string;
  specialInstructions: string;
  legs: LegDraft[];
  cargo: CargoDraft;
};

export function emptyLeg(transportType: LegTransportType = "road"): LegDraft {
  return {
    transportType,
    subtype: "",
    originCountry: "",
    originCity: "",
    originPoint: "",
    destinationCountry: "",
    destinationCity: "",
    destinationPoint: "",
    vehicleType: "",
    vehicleCount: "",
    containerType: "",
    containerCount: "",
    wagonType: "",
    wagonCount: "",
    equipmentDescription: "",
    equipmentCount: "",
    chargeableWeightKg: "",
    volumetricDivisor: "",
    routingPreference: "",
    notes: "",
  };
}

/**
 * Reset the fields that belong to a transport type when the user picks another
 * one, keeping route and notes — those survive a change of mind about *how* the
 * cargo moves. This is what the §24 "warn before clearing" prompt is warning about.
 */
export function resetLegEquipment(leg: LegDraft, transportType: LegTransportType): LegDraft {
  return {
    ...emptyLeg(transportType),
    originCountry: leg.originCountry,
    originCity: leg.originCity,
    destinationCountry: leg.destinationCountry,
    destinationCity: leg.destinationCity,
    notes: leg.notes,
  };
}

/** True when the leg holds any value that a change of transport type would discard. */
export function hasEquipmentData(leg: LegDraft): boolean {
  return [
    leg.subtype,
    leg.originPoint,
    leg.destinationPoint,
    leg.vehicleType,
    leg.vehicleCount,
    leg.containerType,
    leg.containerCount,
    leg.wagonType,
    leg.wagonCount,
    leg.equipmentDescription,
    leg.equipmentCount,
    leg.chargeableWeightKg,
    leg.volumetricDivisor,
    leg.routingPreference,
  ].some((v) => v.trim() !== "");
}

export function emptyDimension(): DimensionDraft {
  return { lengthCm: "", widthCm: "", heightCm: "", quantity: "1" };
}

export function emptyCargo(): CargoDraft {
  return {
    description: "",
    hsCodes: [],
    packages: "",
    grossWeightKg: "",
    volumeM3: "",
    dimensions: [],
    cargoValue: "",
    cargoCurrency: "",
    stackable: "",
    dangerousGoods: false,
    dgClass: "",
    unNumber: "",
    dgNotes: "",
    temperatureControlled: false,
    tempMinC: "",
    tempMaxC: "",
    oversized: false,
    oversizedNotes: "",
  };
}

/**
 * Blank values for the create form. `receivedAt` is filled in by the page, which
 * knows the current time; leaving it to the client would flash an empty field.
 */
export function blankRequestInitial(responsibleUserId: string, receivedAt: string): RequestFormInitial {
  return {
    accountId: "",
    contactId: "",
    responsibleUserId,
    leadSource: "email",
    sourceAgentAccountId: "",
    sourceNote: "",
    emailSubject: "",
    title: "",
    receivedAt,
    transportFamily: "",
    incoterms: "",
    incotermPlace: "",
    cargoReadyDate: "",
    requestedDeliveryDate: "",
    specialInstructions: "",
    legs: [],
    cargo: emptyCargo(),
  };
}

/**
 * Choosing the transport type seeds the legs: one for a single-mode shipment,
 * two to start with for multimodal. Switching between single modes rewrites the
 * one leg's type rather than adding another, keeping the route already typed.
 */
export function seedLegsForFamily(family: string, legs: LegDraft[]): LegDraft[] {
  if (family === "multimodal") {
    return legs.length >= 2 ? legs : [legs[0] ?? emptyLeg(), emptyLeg()];
  }
  if (!isLegTransportType(family)) return [];
  const type = family as LegTransportType;
  const first = legs[0];
  return [
    first
      ? {
          ...emptyLeg(type),
          originCountry: first.originCountry,
          originCity: first.originCity,
          destinationCountry: first.destinationCountry,
          destinationCity: first.destinationCity,
        }
      : emptyLeg(type),
  ];
}
