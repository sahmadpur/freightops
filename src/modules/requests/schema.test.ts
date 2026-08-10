import { describe, expect, it } from "vitest";
import {
  missingForStatus,
  requestInputSchema,
  requestStatusChangeSchema,
  type LegInput,
} from "./schema";

const emptyCargo = {
  description: "Machinery",
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

const leg = (over: Partial<LegInput> = {}) => ({
  transportType: "road",
  subtype: "ftl",
  originCountry: "DE",
  originCity: "Hamburg",
  originPoint: "",
  destinationCountry: "AZ",
  destinationCity: "Baku",
  destinationPoint: "",
  vehicleType: "curtainsider",
  vehicleCount: "2",
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
  ...over,
});

const base = {
  accountId: "acc-1",
  contactId: "con-1",
  responsibleUserId: "usr-1",
  leadSource: "email",
  sourceAgentAccountId: "",
  sourceNote: "",
  emailSubject: "RFQ // 2 trucks Hamburg - Baku",
  title: "",
  receivedAt: "2026-08-07T09:42:00+04:00",
  transportFamily: "road",
  incoterms: "EXW",
  incotermPlace: "Hamburg",
  cargoReadyDate: "2026-08-12",
  requestedDeliveryDate: "",
  specialInstructions: "",
  legs: [leg()],
  cargo: emptyCargo,
};

describe("requestInputSchema", () => {
  it("accepts the specification's Appendix B request", () => {
    expect(requestInputSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a bare draft — source, received time and a manager are enough", () => {
    const r = requestInputSchema.safeParse({
      ...base,
      accountId: "",
      contactId: "",
      emailSubject: "",
      transportFamily: "",
      incoterms: "",
      incotermPlace: "",
      cargoReadyDate: "",
      legs: [],
      cargo: { ...emptyCargo, description: "" },
    });
    expect(r.success).toBe(true);
  });

  it("requires a parsable received timestamp", () => {
    expect(requestInputSchema.safeParse({ ...base, receivedAt: "" }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...base, receivedAt: "yesterday" }).success).toBe(false);
  });

  it("rejects an unknown lead source", () => {
    expect(requestInputSchema.safeParse({ ...base, leadSource: "carrier_pigeon" }).success).toBe(false);
  });
});

describe("transport family and legs", () => {
  it("requires at least two legs for multimodal", () => {
    const one = requestInputSchema.safeParse({ ...base, transportFamily: "multimodal" });
    expect(one.success).toBe(false);
    const two = requestInputSchema.safeParse({
      ...base,
      transportFamily: "multimodal",
      legs: [leg(), leg({ transportType: "sea", subtype: "fcl", vehicleType: "", vehicleCount: "" })],
    });
    expect(two.success).toBe(true);
  });

  it("allows only one leg when the shipment is single-mode", () => {
    const r = requestInputSchema.safeParse({ ...base, legs: [leg(), leg()] });
    expect(r.success).toBe(false);
  });

  it("requires the single leg to match the chosen transport type", () => {
    const r = requestInputSchema.safeParse({
      ...base,
      transportFamily: "sea",
      legs: [leg()],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a subtype from another transport type", () => {
    const r = requestInputSchema.safeParse({
      ...base,
      transportFamily: "sea",
      legs: [leg({ transportType: "sea", subtype: "ftl", vehicleType: "", vehicleCount: "" })],
    });
    expect(r.success).toBe(false);
  });

  it("gives air no subtype", () => {
    const air = (over = {}) =>
      requestInputSchema.safeParse({
        ...base,
        transportFamily: "air",
        legs: [leg({ transportType: "air", subtype: "", vehicleType: "", vehicleCount: "", ...over })],
      });
    expect(air().success).toBe(true);
    expect(air({ subtype: "ltl" }).success).toBe(false);
  });

  it("rejects equipment that belongs to a different transport type", () => {
    const seaLeg = (over = {}) =>
      requestInputSchema.safeParse({
        ...base,
        transportFamily: "sea",
        legs: [leg({ transportType: "sea", subtype: "fcl", vehicleType: "", vehicleCount: "", ...over })],
      });
    expect(seaLeg({ containerType: "40hc", containerCount: "2" }).success).toBe(true);
    expect(seaLeg({ wagonType: "covered" }).success).toBe(false);
    expect(seaLeg({ vehicleType: "reefer" }).success).toBe(false);
    expect(seaLeg({ chargeableWeightKg: "1200" }).success).toBe(false);
  });

  it("requires unit counts to be at least one", () => {
    expect(requestInputSchema.safeParse({ ...base, legs: [leg({ vehicleCount: "0" })] }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...base, legs: [leg({ vehicleCount: "1" })] }).success).toBe(true);
  });

  it("upper-cases country codes and rejects unknown ones", () => {
    const ok = requestInputSchema.safeParse({ ...base, legs: [leg({ originCountry: "de" })] });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.legs[0].originCountry).toBe("DE");
    expect(requestInputSchema.safeParse({ ...base, legs: [leg({ originCountry: "ZZ" })] }).success).toBe(false);
  });
});

describe("conditional cargo blocks", () => {
  const withCargo = (over: Record<string, unknown>) =>
    requestInputSchema.safeParse({ ...base, cargo: { ...emptyCargo, ...over } });

  it("demands a DG class and UN number once dangerous goods is set", () => {
    expect(withCargo({ dangerousGoods: true }).success).toBe(false);
    expect(withCargo({ dangerousGoods: true, dgClass: "3" }).success).toBe(false);
    expect(withCargo({ dangerousGoods: true, dgClass: "3", unNumber: "UN1263" }).success).toBe(true);
  });

  it("demands a temperature range once temperature control is set", () => {
    expect(withCargo({ temperatureControlled: true }).success).toBe(false);
    expect(withCargo({ temperatureControlled: true, tempMinC: "2", tempMaxC: "8" }).success).toBe(true);
  });

  it("accepts sub-zero temperatures", () => {
    expect(withCargo({ temperatureControlled: true, tempMinC: "-25", tempMaxC: "-18" }).success).toBe(true);
  });

  it("rejects a range whose maximum is below its minimum", () => {
    expect(withCargo({ temperatureControlled: true, tempMinC: "8", tempMaxC: "2" }).success).toBe(false);
  });

  it("makes dimensions mandatory for oversized cargo", () => {
    expect(withCargo({ oversized: true }).success).toBe(false);
    expect(
      withCargo({
        oversized: true,
        dimensions: [{ lengthCm: "1200", widthCm: "240", heightCm: "300", quantity: "1" }],
      }).success,
    ).toBe(true);
  });

  it("rejects an incoterm place with no incoterm", () => {
    const r = requestInputSchema.safeParse({ ...base, incoterms: "", incotermPlace: "Hamburg" });
    expect(r.success).toBe(false);
  });
});

describe("missingForStatus", () => {
  const complete = {
    accountId: "acc-1",
    transportFamily: "road",
    legs: [{ originCountry: "DE", destinationCountry: "AZ" }],
    cargoDescription: "Machinery",
  };

  it("asks nothing of a new or cancelled request", () => {
    expect(missingForStatus("new", { ...complete, accountId: null })).toEqual([]);
    expect(missingForStatus("cancelled", { ...complete, accountId: null })).toEqual([]);
  });

  it("names every field in-progress work needs (§24)", () => {
    expect(
      missingForStatus("in_progress", {
        accountId: null,
        transportFamily: null,
        legs: [],
        cargoDescription: null,
      }),
    ).toEqual(["accountId", "transportFamily", "legs", "cargoDescription"]);
  });

  it("passes a complete request", () => {
    expect(missingForStatus("in_progress", complete)).toEqual([]);
    expect(missingForStatus("quotation_sent", complete)).toEqual([]);
  });

  it("reads the route from the first and last leg, not from leg 1 twice", () => {
    const multimodal = {
      ...complete,
      legs: [
        { originCountry: "DE", destinationCountry: "RO" },
        { originCountry: "RO", destinationCountry: null },
      ],
    };
    expect(missingForStatus("in_progress", multimodal)).toEqual(["destinationCountry"]);
  });
});

describe("requestStatusChangeSchema", () => {
  it("requires a reason when a request is lost", () => {
    expect(requestStatusChangeSchema.safeParse({ status: "lost" }).success).toBe(false);
    expect(
      requestStatusChangeSchema.safeParse({ status: "lost", lostReason: "price_too_high" }).success,
    ).toBe(true);
  });

  it("requires a written explanation for the 'other' reason", () => {
    expect(requestStatusChangeSchema.safeParse({ status: "lost", lostReason: "other" }).success).toBe(false);
    expect(
      requestStatusChangeSchema.safeParse({
        status: "lost",
        lostReason: "other",
        lostReasonNote: "Client merged with a competitor",
      }).success,
    ).toBe(true);
  });

  it("refuses a reason on a status that is not lost", () => {
    expect(
      requestStatusChangeSchema.safeParse({ status: "waiting_client", lostReason: "no_response" }).success,
    ).toBe(false);
  });

  it("accepts an ordinary transition", () => {
    expect(requestStatusChangeSchema.safeParse({ status: "in_progress" }).success).toBe(true);
  });
});
