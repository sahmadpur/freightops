import { z } from "zod";
import {
  incotermsEnum,
  leadSourceEnum,
  lostReasonEnum,
  requestStatusEnum,
  transportFamilyEnum,
} from "@/db/schema";
import {
  countryCode,
  dateString,
  intString,
  numericString,
  optEnum,
  optText,
} from "@/lib/validation";
import { ORDER_CURRENCIES } from "@/lib/fx";
import {
  CONTAINER_TYPES,
  isLegTransportType,
  isSubtypeOf,
  LEG_TRANSPORT_TYPES,
  ROUTING_PREFERENCES,
  STACKABLE_VALUES,
  subtypesFor,
  VEHICLE_TYPES,
  WAGON_TYPES,
} from "@/lib/transport-matrix";
export type { ActionResult } from "@/lib/forms";

/** A count of physical units — trucks, containers, wagons. Never zero. */
const unitCount = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "Must be at least 1")
  .optional()
  .or(z.literal(""));

export const dimensionSchema = z.object({
  lengthCm: numericString,
  widthCm: numericString,
  heightCm: numericString,
  quantity: intString,
});

export const legInputSchema = z.object({
  transportType: z.enum(LEG_TRANSPORT_TYPES),
  subtype: optEnum([...subtypesFor("road"), ...subtypesFor("sea"), ...subtypesFor("rail")] as [
    string,
    ...string[],
  ]),
  originCountry: countryCode,
  originCity: optText(200),
  originPoint: optText(200),
  destinationCountry: countryCode,
  destinationCity: optText(200),
  destinationPoint: optText(200),
  vehicleType: optEnum(VEHICLE_TYPES),
  vehicleCount: unitCount,
  containerType: optEnum(CONTAINER_TYPES),
  containerCount: unitCount,
  wagonType: optEnum(WAGON_TYPES),
  wagonCount: unitCount,
  equipmentDescription: optText(500),
  equipmentCount: unitCount,
  chargeableWeightKg: numericString,
  volumetricDivisor: intString,
  routingPreference: optEnum(ROUTING_PREFERENCES),
  notes: optText(2000),
});

export const cargoInputSchema = z.object({
  description: optText(1000),
  hsCodes: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  packages: intString,
  grossWeightKg: numericString,
  volumeM3: numericString,
  dimensions: z.array(dimensionSchema).max(30).default([]),
  cargoValue: numericString,
  cargoCurrency: optEnum(ORDER_CURRENCIES),
  stackable: optEnum(STACKABLE_VALUES),
  dangerousGoods: z.boolean().default(false),
  dgClass: optText(30),
  unNumber: optText(30),
  dgNotes: optText(2000),
  temperatureControlled: z.boolean().default(false),
  // Signed: reefer cargo is routinely below zero.
  tempMinC: z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d{1,2})?$/, "Must be a number")
    .optional()
    .or(z.literal("")),
  tempMaxC: z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d{1,2})?$/, "Must be a number")
    .optional()
    .or(z.literal("")),
  oversized: z.boolean().default(false),
  oversizedNotes: optText(2000),
});

const baseRequestSchema = z.object({
  accountId: optText(100),
  contactId: optText(100),
  responsibleUserId: z.string().trim().min(1),
  leadSource: z.enum(leadSourceEnum.enumValues),
  sourceAgentAccountId: optText(100),
  sourceNote: optText(5000),
  emailSubject: optText(500),
  /** Blank means "derive it from client, route and transport" (§6.2). */
  title: optText(300),
  /** ISO 8601 with an offset — the moment the client actually approached us. */
  receivedAt: z.string().trim().min(1).refine((v) => !Number.isNaN(Date.parse(v)), "Must be a date/time"),
  transportFamily: optEnum(transportFamilyEnum.enumValues),
  incoterms: optEnum(incotermsEnum.enumValues),
  incotermPlace: optText(200),
  cargoReadyDate: dateString,
  requestedDeliveryDate: dateString,
  specialInstructions: optText(5000),
  legs: z.array(legInputSchema).max(20).default([]),
  cargo: cargoInputSchema,
});

export type RequestInput = z.infer<typeof requestInputSchema>;
export type LegInput = z.infer<typeof legInputSchema>;
export type CargoInput = z.infer<typeof cargoInputSchema>;
export type DimensionInput = z.infer<typeof dimensionSchema>;

/**
 * The cross-field rules of §8, §9 and §24.
 *
 * These run on every save, including a draft: an incomplete request is allowed
 * (Save Draft must work with almost nothing filled in), but an *inconsistent*
 * one is not. So "no legs yet" passes and "a sea leg with a wagon type" does
 * not. The stage gates that demand completeness live in `stageRequirements`.
 */
export const requestInputSchema = baseRequestSchema.superRefine((v, ctx) => {
  const family = v.transportFamily;

  if (family === "multimodal") {
    if (v.legs.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["legs"],
        message: "Multimodal needs at least two legs",
      });
    }
  } else if (family && isLegTransportType(family)) {
    if (v.legs.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["legs"],
        message: "Only a multimodal shipment can have several legs",
      });
    }
    if (v.legs.length === 1 && v.legs[0].transportType !== family) {
      ctx.addIssue({
        code: "custom",
        path: ["legs", 0, "transportType"],
        message: "Leg does not match the chosen transport type",
      });
    }
  }

  v.legs.forEach((leg, i) => {
    const at = (field: string, message: string) =>
      ctx.addIssue({ code: "custom", path: ["legs", i, field], message });

    if (leg.subtype && !isSubtypeOf(leg.transportType, leg.subtype)) {
      at("subtype", "Not a subtype of this transport type");
    }
    // Air is the one transport type Appendix A gives no subtypes to.
    if (leg.transportType === "air" && leg.subtype) {
      at("subtype", "Air has no subtype");
    }
    // Equipment that belongs to another transport type is a sign the form state
    // went stale after a type switch — reject rather than silently persist it.
    if (leg.vehicleType && leg.subtype !== "ftl") at("vehicleType", "Only FTL takes a vehicle type");
    if (leg.wagonType && leg.subtype !== "wagon") at("wagonType", "Only rail wagons take a wagon type");
    if (leg.containerType && leg.subtype !== "fcl" && leg.subtype !== "rail_container") {
      at("containerType", "Only container shipments take a container type");
    }
    if (leg.equipmentDescription && leg.subtype !== "roro") {
      at("equipmentDescription", "Only Ro-Ro takes an equipment description");
    }
    if ((leg.chargeableWeightKg || leg.routingPreference) && leg.transportType !== "air") {
      at("chargeableWeightKg", "Only air freight has a chargeable weight");
    }
  });

  const c = v.cargo;
  if (c.dangerousGoods) {
    if (!c.dgClass) ctx.addIssue({ code: "custom", path: ["cargo", "dgClass"], message: "Required for dangerous goods" });
    if (!c.unNumber) ctx.addIssue({ code: "custom", path: ["cargo", "unNumber"], message: "Required for dangerous goods" });
  }
  if (c.temperatureControlled) {
    if (!c.tempMinC) ctx.addIssue({ code: "custom", path: ["cargo", "tempMinC"], message: "Required for temperature-controlled cargo" });
    if (!c.tempMaxC) ctx.addIssue({ code: "custom", path: ["cargo", "tempMaxC"], message: "Required for temperature-controlled cargo" });
    if (c.tempMinC && c.tempMaxC && Number(c.tempMinC) > Number(c.tempMaxC)) {
      ctx.addIssue({ code: "custom", path: ["cargo", "tempMaxC"], message: "Maximum is below the minimum" });
    }
  }
  // §9: oversized cargo must state its dimensions — that is the whole point of
  // flagging it, since the dimensions are what make the shipment special.
  if (c.oversized && c.dimensions.length === 0) {
    ctx.addIssue({ code: "custom", path: ["cargo", "dimensions"], message: "Required for oversized cargo" });
  }
  if (v.incotermPlace && !v.incoterms) {
    ctx.addIssue({ code: "custom", path: ["incoterms"], message: "Choose an incoterm first" });
  }
});

/**
 * What a request must have to reach a given status (§24). Returns the fields
 * that are missing, so the caller can name them rather than just refusing.
 *
 * `new` is deliberately absent: a draft needs only source, received time and a
 * responsible manager, which the schema already requires.
 */
export function missingForStatus(
  status: (typeof requestStatusEnum.enumValues)[number],
  v: {
    accountId: string | null;
    transportFamily: string | null;
    legs: { originCountry: string | null; destinationCountry: string | null }[];
    cargoDescription: string | null;
  },
): string[] {
  if (status === "new" || status === "cancelled") return [];
  const missing: string[] = [];
  if (!v.accountId) missing.push("accountId");
  if (!v.transportFamily) missing.push("transportFamily");
  if (v.legs.length === 0) missing.push("legs");
  else {
    if (!v.legs[0].originCountry) missing.push("originCountry");
    if (!v.legs[v.legs.length - 1].destinationCountry) missing.push("destinationCountry");
  }
  if (!v.cargoDescription) missing.push("cargoDescription");
  return missing;
}

/**
 * A status change. `lost` carries its reason in the same call so a request can
 * never sit in the Lost state without one (§12).
 */
export const requestStatusChangeSchema = z
  .object({
    status: z.enum(requestStatusEnum.enumValues),
    lostReason: optEnum(lostReasonEnum.enumValues),
    lostReasonNote: optText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.status === "lost" && !v.lostReason) {
      ctx.addIssue({ code: "custom", path: ["lostReason"], message: "A lost request needs a reason" });
    }
    if (v.lostReason === "other" && !v.lostReasonNote) {
      ctx.addIssue({ code: "custom", path: ["lostReasonNote"], message: "Explain the reason" });
    }
    if (v.status !== "lost" && v.lostReason) {
      ctx.addIssue({ code: "custom", path: ["lostReason"], message: "Only a lost request has a reason" });
    }
  });

export type RequestStatusChange = z.infer<typeof requestStatusChangeSchema>;

/**
 * Which of the two §14 paths the desk is taking. `direct` is the one that must
 * work with no price at all — that is what makes urgent cargo possible (§16).
 */
export const convertToOrderSchema = z.object({
  mode: z.enum(["from_quotation", "direct"]),
  /** Optional at conversion: the carrier is often chosen during Operations. */
  carrierId: optText(100),
});

export type ConvertToOrderInput = z.infer<typeof convertToOrderSchema>;

/**
 * The source-reference columns conversion carries from the request onto the
 * order (§26), so nothing the desk already typed is lost.
 */
export function orderSourceFields(
  request: {
    id: string;
    contactId: string | null;
    responsibleUserId: string;
    cargoReadyDate: string | null;
    requestedDeliveryDate: string | null;
    specialInstructions: string | null;
  },
  quotationId: string | null,
) {
  return {
    requestId: request.id,
    quotationId,
    contactId: request.contactId,
    responsibleUserId: request.responsibleUserId,
    cargoReadyDate: request.cargoReadyDate,
    requestedDeliveryDate: request.requestedDeliveryDate,
    specialInstructions: request.specialInstructions,
  };
}
