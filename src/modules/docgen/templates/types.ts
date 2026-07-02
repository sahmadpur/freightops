import type { Issuer } from "../issuer";

export type DocLanguage = "en" | "ru" | "az";

export type DocParty = {
  title: string;
  taxId: string | null;
  address: string | null;
};

export type DocOrderInfo = {
  number: string;
  clientOrderId: string | null;
  route: string | null;
  cargoDescription: string | null;
  packages: number | null;
  weightKg: string | null;
  volumeM3: string | null;
  incoterms: string | null;
};

export type DocLine = {
  description: string;
  amountCents: number;
};

/** Shared payload for both document types; all amounts in integer cents (USD). */
export type DocData = {
  issuer: Issuer;
  client: DocParty;
  number: string;
  /** ISO date (YYYY-MM-DD) as chosen in the generate form. */
  date: string;
  order: DocOrderInfo;
  lines: DocLine[];
  totalCents: number;
};

export type InvoiceData = DocData;
export type ActData = DocData;
