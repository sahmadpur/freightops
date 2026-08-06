import type { DocCurrency } from "@/lib/amount-in-words";
import type { Issuer, IssuerBank } from "../issuer";

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
  /** Printed in the "Quantity (units)" column; null leaves the cell empty. */
  quantity: number | null;
  amountCents: number;
};

/** Shared payload for both document types; all amounts in integer minor units. */
export type DocData = {
  issuer: Issuer;
  /** Account and correspondent for the document's currency. */
  bank: IssuerBank;
  client: DocParty;
  number: string;
  /** ISO date (YYYY-MM-DD) as chosen in the generate form. */
  date: string;
  /** Currency the amounts are denominated in, chosen per document. */
  currency: DocCurrency;
  order: DocOrderInfo;
  lines: DocLine[];
  /** Net of VAT — Σ line amounts. VAT and the grand total are derived. */
  totalCents: number;
};

export type InvoiceData = DocData;
export type ActData = DocData;
