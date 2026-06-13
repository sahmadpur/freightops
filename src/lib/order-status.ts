import { orderStatusEnum } from "@/db/schema";

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

/** Canonical lifecycle order, derived from the enum definition (created → closed). */
export const ORDER_STATUS_RANK: Record<OrderStatus, number> = Object.fromEntries(
  orderStatusEnum.enumValues.map((s, i) => [s, i]),
) as Record<OrderStatus, number>;

/** The least-advanced (lowest-rank) status in the list, or null if empty. */
export function leastAdvancedStatus(statuses: OrderStatus[]): OrderStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((min, s) => (ORDER_STATUS_RANK[s] < ORDER_STATUS_RANK[min] ? s : min));
}
