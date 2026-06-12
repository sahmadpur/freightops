import { describe, expect, it } from "vitest";
import { carrierInputSchema } from "./schema";

const valid = {
  title: "Akın Logistics",
  address: "Istanbul",
  notes: "",
  contacts: [{ name: "Mehmet Akın", phones: ["+905324112387"], emails: ["ops@akinlogistics.com.tr"] }],
};

describe("carrierInputSchema", () => {
  it("accepts a valid carrier", () => {
    expect(carrierInputSchema.safeParse(valid).success).toBe(true);
  });
  it("requires title", () => {
    expect(carrierInputSchema.safeParse({ ...valid, title: " " }).success).toBe(false);
  });
  it("has no taxId field", () => {
    const r = carrierInputSchema.safeParse({ ...valid, taxId: "123" });
    expect(r.success).toBe(true);
    if (r.success) expect("taxId" in r.data).toBe(false);
  });
});
