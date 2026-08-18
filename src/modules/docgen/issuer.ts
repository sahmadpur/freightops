/**
 * The freight forwarder's own requisites, printed on generated invoices and
 * ACTs. Read from the environment so each deployment prints its own company
 * (a demo/test instance leaves them unset and gets the neutral placeholders
 * below — no other tenant's requisites are baked into the image).
 *
 * Set ISSUER_* in .env; see .env.prod.example.
 */
const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback;

export const ISSUER = {
  name: env("ISSUER_NAME", "Demo Logistics LLC"),
  address: env("ISSUER_ADDRESS", "1 Demo Street, Baku, AZ"),
  taxId: env("ISSUER_TAX_ID", "0000000000"),
  bankName: env("ISSUER_BANK_NAME", "Demo Bank"),
  bankAccount: env("ISSUER_BANK_ACCOUNT", "AZ00DEMO00000000000000000000"),
  bankCode: env("ISSUER_BANK_CODE", "000000"),
  bankTaxId: env("ISSUER_BANK_TAX_ID", "0000000000"),
  correspondentAccount: env("ISSUER_CORRESPONDENT_ACCOUNT", "AZ00DEMO00000000000000000001"),
  swift: env("ISSUER_SWIFT", "DEMOAZ22XXX"),
  phone: env("ISSUER_PHONE", "+994 12 000 00 00"),
  email: env("ISSUER_EMAIL", "info@demo.local"),
  signatoryName: env("ISSUER_SIGNATORY_NAME", "Demo Director"),
  signatoryTitle: env("ISSUER_SIGNATORY_TITLE", "Direktor"),
};

export type Issuer = typeof ISSUER;
