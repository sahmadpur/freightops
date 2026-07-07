/**
 * The freight forwarder's own requisites, printed on generated invoices and
 * ACTs. Transcribed from the client's real branded invoice template
 * (RDL-AZL HF.xlsx). Promote to a settings table if these ever need to be
 * editable in the UI (multi-currency / editable requisites are out of scope
 * for v1 — see docs/2026-07-02-invoice-act-generation.md).
 */
export const ISSUER = {
  name: "«Redline Supply» MMC",
  address: "Bakı şəh., F.Bayramov küçəsi, ev 5, mən. 27",
  taxId: "2007795241",
  bankName: "Kapital Bank ASC, Port Baku filialı",
  bankAccount: "AZ82AIIB400600E9445910682107",
  bankCode: "201973",
  bankTaxId: "9900003611",
  correspondentAccount: "AZ37NABZ01350100000000001944",
  swift: "AIIBAZ2XXXX",
  phone: "+994 12 000 00 00",
  email: "info@redline.az",
  signatoryName: "Mehdi Orucov",
  signatoryTitle: "Direktor",
} as const;

export type Issuer = typeof ISSUER;
