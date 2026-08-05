import { describe, expect, it } from "vitest";
import { countryFlag, countryLabel, isCountryCode, routeLabel } from "./countries";

describe("isCountryCode", () => {
  it("knows real alpha-2 codes", () => {
    expect(isCountryCode("AZ")).toBe(true);
    expect(isCountryCode("DE")).toBe(true);
  });
  it("rejects unknown codes and free text", () => {
    expect(isCountryCode("ZZ")).toBe(false);
    expect(isCountryCode("az")).toBe(false);
    expect(isCountryCode("Istanbul")).toBe(false);
  });
});

describe("countryFlag", () => {
  it("maps letters to regional indicator symbols", () => {
    expect(countryFlag("AZ")).toBe("\u{1F1E6}\u{1F1FF}");
    expect(countryFlag("DE")).toBe("\u{1F1E9}\u{1F1EA}");
  });
  it("returns empty for anything that isn't two A–Z letters", () => {
    expect(countryFlag("D")).toBe("");
    expect(countryFlag("de")).toBe("");
    expect(countryFlag("")).toBe("");
  });
});

describe("countryLabel", () => {
  it("prefixes the localized name with a flag", () => {
    expect(countryLabel("DE", "en")).toBe("\u{1F1E9}\u{1F1EA} Germany");
  });
  it("localizes the name", () => {
    expect(countryLabel("DE", "ru")).toContain("Герман");
  });
  it("is null when there is no code", () => {
    expect(countryLabel(null, "en")).toBeNull();
    expect(countryLabel("", "en")).toBeNull();
  });
});

describe("routeLabel", () => {
  it("joins both ends with an arrow", () => {
    expect(routeLabel("DE", "AZ", "en")).toBe(
      "\u{1F1E9}\u{1F1EA} Germany → \u{1F1E6}\u{1F1FF} Azerbaijan",
    );
  });
  it("renders whichever end is known", () => {
    expect(routeLabel("DE", null, "en")).toBe("\u{1F1E9}\u{1F1EA} Germany");
    expect(routeLabel(null, "AZ", "en")).toBe("\u{1F1E6}\u{1F1FF} Azerbaijan");
  });
  it("is null when neither end is set", () => {
    expect(routeLabel(null, null, "en")).toBeNull();
  });
  it("omits flags when asked, for PDF rendering", () => {
    expect(routeLabel("DE", "AZ", "en", { flags: false })).toBe("Germany → Azerbaijan");
  });
});
