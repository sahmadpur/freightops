/**
 * "BOSCH | Hamburg → Baku | Road FTL" — the internal, human-readable name of a
 * request (§6.2). Generated on save, then editable; editing it never touches
 * the request number, and it is never confused with the client's email subject.
 *
 * Every segment is optional because a draft may have almost nothing filled in:
 * missing pieces are dropped rather than rendered as blanks, so an early draft
 * still gets a usable name instead of "| → |".
 */
export function buildRequestTitle(parts: {
  clientName?: string | null;
  origin?: string | null;
  destination?: string | null;
  transport?: string | null;
  subtype?: string | null;
}): string {
  const route = [parts.origin, parts.destination].filter(Boolean).join(" → ");
  const transport = [parts.transport, parts.subtype].filter(Boolean).join(" ");
  const segments = [parts.clientName, route, transport].map((s) => s?.trim()).filter(Boolean);
  return segments.join(" | ");
}
