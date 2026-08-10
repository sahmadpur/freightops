/**
 * The commercial lifecycle of a Request, in order. This is the single source of
 * truth: the `request_status` pgEnum in `src/db/schema/domain.ts` is built from
 * this list, and client components import it without pulling drizzle into the
 * browser bundle. Labels live in the shared `status` i18n namespace.
 *
 * Deliberately distinct from ORDER_STATUSES: a request answers "what is
 * happening with the enquiry?", an order answers "where is the cargo?".
 */
export const REQUEST_STATUSES = [
  "new",
  "in_progress",
  "quotation",
  "quotation_sent",
  "waiting_client",
  "won",
  "lost",
  "cancelled",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Terminal statuses: the enquiry is decided and no longer in the pipeline. */
export const CLOSED_REQUEST_STATUSES = ["won", "lost", "cancelled"] as const satisfies readonly RequestStatus[];

export function isClosedRequestStatus(status: RequestStatus): boolean {
  return (CLOSED_REQUEST_STATUSES as readonly RequestStatus[]).includes(status);
}

/**
 * The KPI timestamp each status stamps on arrival (spec §23). A status absent
 * from this map stamps nothing. `decided_at` is shared by all three terminal
 * statuses — the status column says which of them it was.
 */
export const REQUEST_STATUS_TIMESTAMP = {
  in_progress: "workStartedAt",
  quotation: "quotationStartedAt",
  quotation_sent: "quotationSentAt",
  won: "decisionAt",
  lost: "decisionAt",
  cancelled: "decisionAt",
} as const satisfies Partial<Record<RequestStatus, string>>;

export type RequestTimestampField =
  (typeof REQUEST_STATUS_TIMESTAMP)[keyof typeof REQUEST_STATUS_TIMESTAMP];

/** The timestamp field a transition into `status` should stamp, if any. */
export function timestampFor(status: RequestStatus): RequestTimestampField | null {
  return status in REQUEST_STATUS_TIMESTAMP
    ? REQUEST_STATUS_TIMESTAMP[status as keyof typeof REQUEST_STATUS_TIMESTAMP]
    : null;
}
