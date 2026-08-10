/**
 * Why a request did not convert (spec §12). Mandatory when a request is closed
 * as Lost; `other` additionally requires a free-text note. Feeds the
 * `lost_reason` pgEnum and the Lost Reasons KPI. Labels live in the
 * `lostReason` i18n namespace.
 */
export const LOST_REASONS = [
  "price_too_high",
  "chose_competitor",
  "transit_time",
  "no_solution",
  "no_response",
  "cargo_cancelled",
  "informational_only",
  "other",
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

/** The only reason that also demands a written explanation. */
export function requiresNote(reason: LostReason): boolean {
  return reason === "other";
}
