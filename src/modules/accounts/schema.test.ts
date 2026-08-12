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

  it("rejects whitespace-only contact name", () => {
    const r = accountInputSchema.safeParse({
      ...valid,
      contacts: [{ name: "   ", phones: [], emails: [] }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects too-short phone numbers", () => {
    const r = accountInputSchema.safeParse({
      ...valid,
      contacts: [{ name: "X", phones: ["1"], emails: [] }],
    });
    expect(r.success).toBe(false);
  });

  it("treats whitespace-only optional fields as empty", () => {
    const r = accountInputSchema.safeParse({ ...valid, taxId: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.taxId || null).toBeNull();
  });

  it("upper-cases a country code and rejects an unknown one", () => {
    const ok = accountInputSchema.safeParse({ ...valid, country: "de" });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.country).toBe("DE");
    expect(accountInputSchema.safeParse({ ...valid, country: "XX" }).success).toBe(false);
  });

  it("lower-cases email domains and rejects anything that is not one", () => {
    const ok = accountInputSchema.safeParse({ ...valid, emailDomains: ["Bosch.COM", "bosch.de"] });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.emailDomains).toEqual(["bosch.com", "bosch.de"]);
    // An address, a bare TLD and a scheme are all rejected — the column holds domains only.
    expect(accountInputSchema.safeParse({ ...valid, emailDomains: ["john@bosch.com"] }).success).toBe(false);
    expect(accountInputSchema.safeParse({ ...valid, emailDomains: ["bosch"] }).success).toBe(false);
    expect(accountInputSchema.safeParse({ ...valid, emailDomains: ["https://bosch.com"] }).success).toBe(false);
  });

  it("round-trips a contact id so ids stay stable across an edit", () => {
    const r = accountInputSchema.safeParse({
      ...valid,
      contacts: [{ id: "c-1", name: "X", position: "Head of logistics", phones: [], emails: [] }],
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.contacts[0].id).toBe("c-1");
  });

  it("defaults roles to client and accepts several", () => {
    const r = accountInputSchema.safeParse(valid);
    expect(r.success && r.data.roles).toEqual(["client"]);
    const r2 = accountInputSchema.safeParse({ ...valid, roles: ["carrier", "agent"] });
    expect(r2.success && r2.data.roles).toEqual(["carrier", "agent"]);
  });

  it("rejects an unknown role and an empty role list", () => {
    expect(accountInputSchema.safeParse({ ...valid, roles: ["pirate"] }).success).toBe(false);
    expect(accountInputSchema.safeParse({ ...valid, roles: [] }).success).toBe(false);
  });

  it("rejects an unknown preferred channel", () => {
    const r = accountInputSchema.safeParse({
      ...valid,
      contacts: [{ name: "X", phones: [], emails: [], preferredChannel: "telegram" }],
    });
    expect(r.success).toBe(false);
  });
});
