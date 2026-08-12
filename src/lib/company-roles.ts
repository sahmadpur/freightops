/**
 * Roles a company (account) can hold, several at once (spec: one company base,
 * flexible roles). Stored as text[] on accounts.roles.
 */
export const COMPANY_ROLES = [
  "client",
  "agent",
  "carrier",
  "supplier",
  "customs_broker",
  "other",
] as const;

export type CompanyRole = (typeof COMPANY_ROLES)[number];
