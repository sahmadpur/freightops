/**
 * How a commercial enquiry reached us (specification §6.1, §18). The channel is
 * a property of the request, not a separate business process — every source
 * produces the same Request entity. Feeds the `lead_source` pgEnum and the
 * "Requests by Source" KPI. Labels live in the `leadSource` i18n namespace.
 */
export const LEAD_SOURCES = [
  "email",
  "whatsapp",
  "phone",
  "website",
  "agent",
  "partner",
  "tender",
  "other",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

/** Sources that carry an original email subject worth keeping for search (§6.2). */
export function hasEmailSubject(source: LeadSource): boolean {
  return source === "email";
}

/**
 * Sources where the substance of the enquiry only exists as the manager's own
 * summary — the form shows a call/source note for these (§6.3 field 7).
 */
export function needsSourceNote(source: LeadSource): boolean {
  return source === "phone" || source === "whatsapp" || source === "other";
}

/** Sources that may name a referring agent or partner company (§6.1, §18). */
export function hasSourceAgent(source: LeadSource): boolean {
  return source === "agent" || source === "partner";
}
