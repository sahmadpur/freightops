/**
 * The freight forwarder's own requisites, printed on generated invoices and
 * ACTs. Provisional placeholder values — replace with the real requisites when
 * the client supplies their branded templates (or promote to a settings table
 * if they ever need to be editable in the UI).
 */
export const ISSUER = {
  name: "FreightOps LLC",
  address: "1 Logistics Way, Baku, Azerbaijan",
  taxId: "0000000000",
  bankName: "Example Bank OJSC",
  bankAccount: "AZ00EXMP0000000000000000000000",
  swift: "EXMPAZ22",
  phone: "+994 00 000 00 00",
  email: "billing@freightops.example",
  signatoryName: "Full Name",
  signatoryTitle: "Director",
} as const;

export type Issuer = typeof ISSUER;
