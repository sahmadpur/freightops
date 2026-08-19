import { describe, expect, it } from "vitest";
import { ISSUER, ISSUER_BANKS } from "../issuer";
import { renderActHtml } from "./act";
import { renderInvoiceHtml } from "./invoice";
import { esc, formatDocDate } from "./layout";
import { docTotals } from "./partials";
import type { DocData, DocLanguage } from "./types";

const LANGS: DocLanguage[] = ["en", "ru", "az"];

function sampleData(overrides: Partial<DocData> = {}): DocData {
  return {
    issuer: ISSUER,
    bank: ISSUER_BANKS.AZN,
    client: { title: "Acme Trading LLC", taxId: "1234567890", address: "42 Client St, Baku" },
    number: "RL-020726007",
    date: "2026-07-02",
    currency: "AZN",
    order: {
      number: "ALL2607041",
      route: "Istanbul — Baku",
      cargoDescription: "Industrial spare parts",
      packages: 12,
      weightKg: "3400.00",
      volumeM3: "18.50",
      incoterms: "FCA",
    },
    lines: [
      { description: "Freight forwarding services for order ALL2607041", quantity: 12, amountCents: 420000 },
      { description: "Customs terminal fees", quantity: null, amountCents: 15050 },
    ],
    totalCents: 435050,
    ...overrides,
  };
}

describe("esc", () => {
  it("neutralizes HTML in interpolated values", () => {
    expect(esc(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });
});

describe("formatDocDate", () => {
  it("renders per-language formats", () => {
    expect(formatDocDate("2026-07-02", "en")).toBe("July 2, 2026");
    expect(formatDocDate("2026-07-02", "ru")).toBe("02.07.2026");
    expect(formatDocDate("2026-07-02", "az")).toBe("02.07.2026");
  });
});

describe("docTotals", () => {
  it("adds 18% VAT on top of the net total", () => {
    expect(docTotals(435050)).toEqual({ vatCents: 78309, grandTotalCents: 513359 });
  });
  it("rounds VAT to the nearest cent", () => {
    // 3.33 × 18% = 0.5994 → 0.60
    expect(docTotals(333)).toEqual({ vatCents: 60, grandTotalCents: 393 });
  });
});

describe.each(LANGS)("invoice template (%s)", (lang) => {
  const html = renderInvoiceHtml(sampleData(), lang);
  it("contains the number, client, order and totals", () => {
    expect(html).toContain("RL-020726007");
    expect(html).toContain("Acme Trading LLC");
    expect(html).toContain("ALL2607041");
    expect(html).toContain("4,350.50"); // net
    expect(html).toContain("783.09"); // VAT 18%
    expect(html).toContain("5,133.59"); // grand total
  });
  it("names the currency, the 18% VAT row and the amount in words", () => {
    expect(html).toContain("(AZN)");
    expect(html).toMatch(/VAT 18%|НДС 18%|ƏDV 18%/);
    // The words line spells the gross amount, not the net one.
    expect(html).toMatch(/manat|манат/);
    expect(html).toMatch(/beş min|пять тысяч|five thousand/i);
  });
  it("prints the currency's own account and correspondent", () => {
    expect(html).toContain(ISSUER_BANKS.AZN.account);
    expect(html).not.toContain(ISSUER_BANKS.USD.account);
  });
  it("prints the package count in the quantity column", () => {
    expect(html).toContain(">12<");
  });
  it("escapes hostile order data", () => {
    const hostile = sampleData();
    hostile.order.cargoDescription = `<script>alert("pwn")</script>`;
    const out = renderInvoiceHtml(hostile, lang);
    expect(out).not.toContain("<script>alert");
  });
});

describe.each(LANGS)("act template (%s)", (lang) => {
  const html = renderActHtml(sampleData({ number: "AKT № 03" }), lang);
  it("contains the number, both parties and the gross total", () => {
    expect(html).toContain("AKT № 03");
    expect(html).toContain("Acme Trading LLC");
    expect(html).toContain(ISSUER.name);
    expect(html).toContain("5,133.59");
  });
  it("carries no bank details", () => {
    expect(html).not.toContain(ISSUER_BANKS.AZN.account);
  });
});

describe("language-specific wording", () => {
  it("uses Russian wording for ru", () => {
    const html = renderActHtml(sampleData(), "ru");
    expect(html).toContain("о приеме-передаче выполненных работ и оказанных услуг");
    expect(html).toContain("г. Баку");
    expect(html).toContain("Передал");
  });
  it("uses Azerbaijani wording for az", () => {
    const html = renderActHtml(sampleData(), "az");
    expect(html).toContain("təhvil-təslimi haqqında");
    expect(html).toContain("Bakı şəhəri");
    expect(html).toContain("Təhvil aldı");
  });
  it("uses the Azerbaijani invoice title for az", () => {
    expect(renderInvoiceHtml(sampleData(), "az")).toContain("HESAB-FAKTURA");
    expect(renderInvoiceHtml(sampleData(), "ru")).toContain("СЧЕТ-ФАКТУРА");
  });
});
