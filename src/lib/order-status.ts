/**
 * The operational lifecycle of an order, in order (specification §15). This is
 * the single source of truth: the `order_status` pgEnum in
 * `src/db/schema/domain.ts` is built from this list, and client components
 * import it without pulling drizzle into the browser bundle. Labels live in the
 * `status` i18n namespace.
 *
 * `en_route` is domestic / first-mile movement («В пути»); `in_transit` is the
 * international main carriage («В транзите») — the client's corrections doc
 * lists both as distinct stages.
 *
 * Distinct from REQUEST_STATUSES, which answer "what is happening with the
 * enquiry?" rather than "where is the cargo?". The two value sets are disjoint,
 * so they can share the `status` message namespace and the badge component.
 */
export const ORDER_STATUSES = [
  "created",
  "waiting_pickup",
  "en_route",
  "in_transit",
  "ferry_wait",
  "at_customs",
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
 * Statuses retired across lifecycle revisions. They no longer appear on any
 * order, but the audit log still holds them as old values, so the history tab
 * must be able to name them — hence they keep their `status.*` message keys and
 * their `--status-*` hues. (`waiting_pickup`/`at_customs` were un-retired by
 * the corrections round; `operations`/`booked` replaced them here.)
 */
export const RETIRED_ORDER_STATUSES = [
  "operations",
  "booked",
  "received",
  "internal_transit",
  "loaded",
  "transit",
  "at_border",
  "arrived",
] as const;
