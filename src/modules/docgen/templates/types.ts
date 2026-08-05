import type { DocCurrency } from "@/lib/amount-in-words";
import type { Issuer } from "../issuer";

export type DocLanguage = "en" | "ru" | "az";

export type DocParty = {
  title: string;
  taxId: string | null;
  address: string | null;
};

export type DocOrderInfo = {
  number: string;
  rollbackNumber: string | null;
  /** Pre-rendered "From → To" route line; the order stores country codes. */
  route: string | null;
  /** Pre-rendered cargo line; the order stores a list of items. */
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

/** Shared payload for both document types; all amounts in integer minor units. */
export type DocData = {
  issuer: Issuer;
  client: DocParty;
  number: string;
  /** ISO date (YYYY-MM-DD) as chosen in the generate form. */
  date: string;
  /** Currency the amounts are denominated in, chosen per document. */
  currency: DocCurrency;
  order: DocOrderInfo;
  lines: DocLine[];
  totalCents: number;
};

export type InvoiceData = DocData;
export type ActData = DocData;
