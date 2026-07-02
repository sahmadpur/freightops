import { describe, expect, it } from "vitest";
import { ISSUER } from "../issuer";
import { renderActHtml } from "./act";
import { renderInvoiceHtml } from "./invoice";
import { esc, formatDocDate } from "./layout";
import type { DocData, DocLanguage } from "./types";

const LANGS: DocLanguage[] = ["en", "ru", "az"];

function sampleData(overrides: Partial<DocData> = {}): DocData {
  return {
    issuer: ISSUER,
    client: { title: "Acme Trading LLC", taxId: "1234567890", address: "42 Client St, Baku" },
    number: "INV-2026-007",
    date: "2026-07-02",
    order: {
      number: "ORD-2026-041",
      clientOrderId: "PO-991",
      route: "Istanbul — Baku",
      cargoDescription: "Industrial spare parts",
      packages: 12,
      weightKg: "3400.00",
      volumeM3: "18.50",
      incoterms: "FCA",
    },
    lines: [
      { description: "Freight forwarding services for order ORD-2026-041", amountCents: 420000 },
      { description: "Customs terminal fees", amountCents: 15050 },
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

describe.each(LANGS)("invoice template (%s)", (lang) => {
  const html = renderInvoiceHtml(sampleData(), lang);
  it("contains the number, client, order and total", () => {
    expect(html).toContain("INV-2026-007");
    expect(html).toContain("Acme Trading LLC");
    expect(html).toContain("ORD-2026-041");
    expect(html).toContain("4,350.50");
  });
  it("escapes hostile order data", () => {
    const hostile = sampleData();
    hostile.order.cargoDescription = `<script>alert("pwn")</script>`;
    const out = renderInvoiceHtml(hostile, lang);
    expect(out).not.toContain("<script>alert");
  });
});

describe.each(LANGS)("act template (%s)", (lang) => {
  const html = renderActHtml(sampleData({ number: "ACT-2026-003" }), lang);
  it("contains the number, both parties and total", () => {
    expect(html).toContain("ACT-2026-003");
    expect(html).toContain("Acme Trading LLC");
    expect(html).toContain(ISSUER.name);
    expect(html).toContain("4,350.50");
  });
});

describe("language-specific wording", () => {
  it("uses Russian headings for ru", () => {
    const html = renderActHtml(sampleData(), "ru");
    expect(html).toContain("АКТ ВЫПОЛНЕННЫХ РАБОТ");
    expect(html).toContain("Исполнитель");
    expect(html).toContain("М.П.");
  });
  it("uses Azerbaijani headings for az", () => {
    const html = renderActHtml(sampleData(), "az");
    expect(html).toContain("GÖRÜLMÜŞ İŞLƏR");
    expect(html).toContain("Sifarişçi");
  });
});
