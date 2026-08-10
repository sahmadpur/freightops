/**
 * The operational lifecycle of an order, in order (specification §15). This is
 * the single source of truth: the `order_status` pgEnum in
 * `src/db/schema/domain.ts` is built from this list, and client components
 * import it without pulling drizzle into the browser bundle. Labels live in the
 * `status` i18n namespace.
 *
 * "Operations" is deliberate — Appendix D forbids "Execution" as the name of
 * this phase. `booked` is optional in practice: a desk that does not track
 * carrier confirmation separately simply never selects it.
 *
 * Distinct from REQUEST_STATUSES, which answer "what is happening with the
 * enquiry?" rather than "where is the cargo?". The two value sets are disjoint,
 * so they can share the `status` message namespace and the badge component.
 */
export const ORDER_STATUSES = [
  "created",
  "operations",
  "booked",
  "in_transit",
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

/**
 * Statuses retired when the lifecycle was reduced to the six above. They no
 * longer appear on any order, but the audit log still holds them as old values,
 * so the history tab must be able to name them — hence they keep their
 * `status.*` message keys and their `--status-*` hues.
 */
export const RETIRED_ORDER_STATUSES = [
  "waiting_pickup",
  "received",
  "internal_transit",
  "loaded",
  "transit",
  "at_border",
  "at_customs",
  "arrived",
] as const;
