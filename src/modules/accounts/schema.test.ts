import { describe, expect, it } from "vitest";
import { accountInputSchema } from "./schema";

const valid = {
  title: "Baku Steel LLC",
  taxId: "1402556671",
  address: "Baku, Heydar Aliyev ave 1",
  notes: "",
  contacts: [{ name: "Elçin Məmməd", phones: ["+994501234567"], emails: ["elcin@bakusteel.az"] }],
};

describe("accountInputSchema", () => {
  it("accepts a valid account", () => {
    expect(accountInputSchema.safeParse(valid).success).toBe(true);
  });

  it("requires title", () => {
    const r = accountInputSchema.safeParse({ ...valid, title: "" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid contact emails", () => {
    const r = accountInputSchema.safeParse({
      ...valid,
      contacts: [{ name: "X", phones: [], emails: ["not-an-email"] }],
    });
    expect(r.success).toBe(false);
  });

  it("allows zero contacts and trims empty phone/email entries", () => {
    const r = accountInputSchema.safeParse({ ...valid, contacts: [] });
    expect(r.success).toBe(true);
    const r2 = accountInputSchema.safeParse({
      ...valid,
      contacts: [{ name: "X", phones: ["  "], emails: [""] }],
    });
    expect(r2.success).toBe(true);
    if (r2.success) {
      expect(r2.data.contacts[0].phones).toEqual([]);
      expect(r2.data.contacts[0].emails).toEqual([]);
    }
  });

  it("caps contacts at 20 and phones/emails at 10 each", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `C${i}`, phones: [], emails: [] }));
    expect(accountInputSchema.safeParse({ ...valid, contacts: many }).success).toBe(false);
  });
});
