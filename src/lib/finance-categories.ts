/**
 * Agent-expense categories, mirroring the `finance_category` pgEnum in
 * `src/db/schema/domain.ts`. Kept db-free so client forms can bundle it.
 * Labels live in the `financeCategory` i18n namespace.
 */
export const FINANCE_CATEGORIES = [
  "customs",
  "broker",
  "terminal",
  "warehouse",
  "loading",
  "transport",
  "insurance",
  "certification",
  "demurrage",
  "bank_fee",
  "other",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

/**
 * Customs-clearance cost categories, mirroring `customs_item_category`.
 * Labels live in the `customsCategory` i18n namespace.
 */
export const CUSTOMS_CATEGORIES = [
  "documentation_fee",
  "declaration_main_page",
  "declaration_additional_page",
  "short_declaration",
  "broker_fee",
  "inspector_fee",
  "handling",
  "terminal",
  "delivery",
] as const;

export type CustomsCategory = (typeof CUSTOMS_CATEGORIES)[number];
