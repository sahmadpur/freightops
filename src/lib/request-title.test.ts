import { describe, expect, it } from "vitest";
import { buildRequestTitle } from "./request-title";

describe("buildRequestTitle", () => {
  it("renders the specification's example", () => {
    expect(
      buildRequestTitle({
        clientName: "BOSCH",
        origin: "Hamburg",
        destination: "Baku",
        transport: "Road",
        subtype: "FTL",
      }),
    ).toBe("BOSCH | Hamburg → Baku | Road FTL");
  });

  it("drops segments a draft does not have yet rather than leaving blanks", () => {
    expect(buildRequestTitle({ clientName: "BOSCH" })).toBe("BOSCH");
    expect(buildRequestTitle({ origin: "Hamburg", destination: "Baku" })).toBe("Hamburg → Baku");
    expect(buildRequestTitle({ clientName: "BOSCH", transport: "Air" })).toBe("BOSCH | Air");
  });

  it("keeps a one-sided route readable", () => {
    expect(buildRequestTitle({ clientName: "BOSCH", origin: "Hamburg" })).toBe("BOSCH | Hamburg");
  });

  it("omits a subtype the transport type does not have", () => {
    expect(buildRequestTitle({ clientName: "X", transport: "Air", subtype: "" })).toBe("X | Air");
  });

  it("is empty when nothing is known", () => {
    expect(buildRequestTitle({})).toBe("");
  });

  it("trims stray whitespace from the parts", () => {
    expect(buildRequestTitle({ clientName: "  BOSCH  ", transport: " Road " })).toBe("BOSCH | Road");
  });
});
