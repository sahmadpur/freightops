/**
 * The canonical order lifecycle, in order. This is the single source of truth:
 * the `order_status` pgEnum in `src/db/schema/domain.ts` is built from this
 * list, and client components import it without pulling drizzle into the
 * browser bundle. Labels live in the `status` i18n namespace.
 */
export const ORDER_STATUSES = [
  "created",
  "waiting_pickup",
  "received",
  "internal_transit",
  "loaded",
  "transit",
  "at_border",
  "at_customs",
  "arrived",
  "delivered",
  "closed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Canonical lifecycle order, derived from the list above (created → closed). */
export const ORDER_STATUS_RANK: Record<OrderStatus, number> = Object.fromEntries(
  ORDER_STATUSES.map((s, i) => [s, i]),
) as Record<OrderStatus, number>;

/** The least-advanced (lowest-rank) status in the list, or null if empty. */
export function leastAdvancedStatus(statuses: OrderStatus[]): OrderStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((min, s) => (ORDER_STATUS_RANK[s] < ORDER_STATUS_RANK[min] ? s : min));
}
