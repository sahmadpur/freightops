import { ORDER_STATUS_RANK, type OrderStatus } from "./order-status";

/**
 * CSS reference to a shipment stage's hue token (`--status-*` in globals.css).
 * Shared by the status badge and the dashboard's stacked status bar so the two
 * can't drift, and so both follow the light/dark token flip. Unknown values
 * fall back to the closed/neutral hue.
 */
export function statusHue(status: string): string {
  const known = status in ORDER_STATUS_RANK ? (status as OrderStatus) : "closed";
  return `var(--status-${known})`;
}
