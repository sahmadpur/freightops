/**
 * How the cargo is packed, mirroring the `packaging_type` pgEnum in
 * `src/db/schema/domain.ts`. Kept db-free so client forms can bundle it.
 * Labels live in the `packagingType` i18n namespace.
 */
export const PACKAGING_TYPES = [
  "pallet",
  "box",
  "crate",
  "bag",
  "drum",
  "roll",
  "other",
] as const;

export type PackagingType = (typeof PACKAGING_TYPES)[number];
