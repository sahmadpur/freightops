import type { DocCurrency } from "@/lib/amount-in-words";

/**
 * The forwarder's own requisites, printed on generated invoices and ACTs.
 * Transcribed from the company's real Word templates (Invoice_*.docx,
 * Act_*.docx). Promote to a settings table if these ever need to be editable in
 * the UI (out of scope for v1 — see docs/2026-07-02-invoice-act-generation.md).
 */
export const ISSUER = {
  name: "“ALL IN LOG” MMC",
  address: "Azərbaycan, Bakı, Məqsud Əlizadə 38",
  taxId: "1506805111",
  bankName: "KapitalBank ASC, Bravo 3 filialı",
  bankCode: "201296",
  bankTaxId: "9900003611",
  swift: "AIIBAZ2XXXX",
  signatoryName: "Ələkbərov Vüsal",
} as const;

export type Issuer = typeof ISSUER;

/**
 * Per-currency account, because each currency clears through a different
 * correspondent. Bank names, BIK/INN and account numbers are proper nouns and
 * are printed verbatim in the form the bank itself uses (the RUB correspondent
 * only exists in Russian), whatever language the document is issued in.
 */
export type IssuerBank = {
  account: string;
  correspondentBank: string | null;
  correspondentSwift: string | null;
  /** May carry more than one account, joined with "; " (RUB). */
  correspondentAccount: string | null;
};

export const ISSUER_BANKS: Record<DocCurrency, IssuerBank> = {
  AZN: {
    account: "AZ26AIIB400500H9444261550218",
    correspondentBank: null,
    correspondentSwift: null,
    correspondentAccount: "AZ37NABZ01350100000000001944",
  },
  USD: {
    account: "AZ60AIIB401500H8404261551218",
    correspondentBank: "Bank of New York Mellon",
    correspondentSwift: "IRVTUS3N",
    correspondentAccount: "8901723762",
  },
  EUR: {
    account: "AZ06AIIB401500H9784261552218",
    correspondentBank: "Raiffeisen Bank International AG, Vienna, Austria",
    correspondentSwift: "RZBAATWW",
    correspondentAccount: "001-55.075.527",
  },
  RUB: {
    account: "AZ81AIIB401500H6434261553218",
    correspondentBank: 'АО "Райффайзенбанк", БИК: 044525700, ИНН: 7744000302',
    correspondentSwift: null,
    correspondentAccount: "30111810200000000015; 30101810200000000700 в ГУ Банка России",
  },
};
