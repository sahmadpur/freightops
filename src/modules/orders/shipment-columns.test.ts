import { describe, expect, it } from "vitest";
import { legacyLegDraft, shipmentColumns } from "./shipment-columns";

const leg = (over: Partial<Parameters<typeof shipmentColumns>[0][number]> = {}) => ({
  transportType: "road",
  subtype: "ftl",
  originCountry: "TR",
  originCity: "Istanbul",
  destinationCountry: "AZ",
  destinationCity: "Baku",
  ...over,
});

describe("shipmentColumns", () => {
  it("takes the route from the first and last leg", () => {
    const cols = shipmentColumns(
      [
        leg({ destinationCountry: "GE", destinationCity: "Poti" }),
        leg({ transportType: "sea", subtype: "fcl", originCountry: "GE", originCity: "Poti" }),
      ],
      null,
    );
    expect(cols.fromCountry).toBe("TR");
    expect(cols.fromCity).toBe("Istanbul");
    expect(cols.toCountry).toBe("AZ");
    expect(cols.toCity).toBe("Baku");
  });

  it("types a multi-leg shipment by the leg it starts in", () => {
    expect(shipmentColumns([leg(), leg({ transportType: "sea" })], null).transportType).toBe("truck");
    expect(shipmentColumns([leg({ transportType: "rail" })], null).transportType).toBe("rail");
  });

  it("derives the delivery format only from subtypes that are one", () => {
    expect(shipmentColumns([leg()], null).deliveryFormat).toBe("FTL");
    expect(shipmentColumns([leg({ transportType: "sea", subtype: "roro" })], null).deliveryFormat).toBeNull();
    expect(shipmentColumns([leg({ subtype: "" })], null).deliveryFormat).toBeNull();
  });

  it("carries the cargo totals across, string or number", () => {
    const fromDraft = shipmentColumns([leg()], {
      description: "Machinery",
      packages: "24",
      grossWeightKg: "8400",
      volumeM3: "",
    });
    expect(fromDraft).toMatchObject({
      cargoItems: ["Machinery"],
      packages: 24,
      weightKg: "8400",
      volumeM3: null,
    });
    const fromRow = shipmentColumns([leg()], { description: null, packages: 3, grossWeightKg: "12.50" });
    expect(fromRow).toMatchObject({ cargoItems: [], packages: 3, weightKg: "12.50" });
  });

  it("empties every column when the shipment has no legs", () => {
    expect(shipmentColumns([], null)).toMatchObject({
      transportType: null,
      fromCountry: null,
      toCountry: null,
      deliveryFormat: null,
      cargoItems: [],
    });
  });
});

describe("legacyLegDraft", () => {
  const order = {
    transportType: "truck",
    fromCountry: "TR",
    fromCity: "Istanbul",
    toCountry: "AZ",
    toCity: "Baku",
    deliveryFormat: "FTL",
  };

  it("rebuilds one leg from the flat columns", () => {
    expect(legacyLegDraft(order)).toMatchObject({
      transportType: "road",
      subtype: "ftl",
      originCountry: "TR",
      destinationCity: "Baku",
    });
  });

  it("drops a delivery format that is not a subtype of that transport type", () => {
    expect(legacyLegDraft({ ...order, deliveryFormat: "FCL" })?.subtype).toBe("");
  });

  it("seeds nothing for the retired transport vocabulary", () => {
    expect(legacyLegDraft({ ...order, transportType: "postal" })).toBeNull();
    expect(legacyLegDraft({ ...order, transportType: null })).toBeNull();
  });

  // Round trip: what the bridge produces must derive the columns it came from.
  it("round-trips back to the same columns", () => {
    const draft = legacyLegDraft(order)!;
    expect(shipmentColumns([draft], null)).toMatchObject({
      transportType: "truck",
      fromCountry: "TR",
      toCity: "Baku",
      deliveryFormat: "FTL",
    });
  });
});
