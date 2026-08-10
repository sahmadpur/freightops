import { ORDER_STATUSES, RETIRED_ORDER_STATUSES } from "./order-status";
import { REQUEST_STATUSES } from "./request-status";

/**
 * Every status that has a `--status-*` token in globals.css — including the
 * retired order statuses, which still appear as old values in the history tab.
 */
const KNOWN: ReadonlySet<string> = new Set<string>([
  ...ORDER_STATUSES,
  ...RETIRED_ORDER_STATUSES,
  ...REQUEST_STATUSES,
]);

/**
 * CSS reference to a stage's hue token (`--status-*` in globals.css). Shared by
 * the status badge and the dashboard's stacked status bar so the two can't
 * drift, and so both follow the light/dark token flip. Covers both the order
 * (shipment) and request (commercial) lifecycles — their value sets are
 * disjoint. Unknown values fall back to the closed/neutral hue.
 */
export function statusHue(status: string): string {
  return `var(--status-${KNOWN.has(status) ? status : "closed"})`;
}
