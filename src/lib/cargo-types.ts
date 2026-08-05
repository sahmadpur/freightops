/**
 * Suggested cargo descriptions for the order form's multi-select. The list is a
 * starting point, not a constraint: the control is creatable, so the desk can
 * type anything and it is stored verbatim in `orders.cargo_items`.
 *
 * Labels live in the `cargoTypes` i18n namespace; the stored value is the
 * translated label the user picked.
 */
export const CARGO_TYPES = [
  "generalCargo",
  "machinery",
  "spareParts",
  "constructionMaterials",
  "chemicals",
  "foodstuffs",
  "textiles",
  "electronics",
  "furniture",
  "pharmaceuticals",
  "automotive",
  "packagingMaterials",
  "frozenGoods",
  "dangerousGoods",
  "personalEffects",
] as const;

export type CargoType = (typeof CARGO_TYPES)[number];
