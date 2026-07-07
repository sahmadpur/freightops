/**
 * Pure document-number formatting, shared by the server allocator
 * (src/lib/doc-number.ts) and the client generate form (which previews the
 * number and must re-format it as the user edits the document date). Kept free
 * of any db/server imports so it is safe to bundle into a client component.
 *
 * Formats match the client's real templates:
 *   invoice → "RL-270326004"  (RL-DDMMYY + 3-digit sequence)
 *   act     → "AKT № 01"       (2-digit sequence)
 */

export type DocKind = "invoice" | "act";

/** ISO YYYY-MM-DD → DDMMYY (the date component of an invoice number). */
function ddmmyy(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}${m}${y.slice(2)}`;
}

/**
 * Format a document number from its kind, ISO document date and 1-based
 * sequence. The invoice number embeds the document date, so a preview must be
 * re-formatted whenever the chosen date changes.
 */
export function formatDocNumber(kind: DocKind, isoDate: string, seq: number): string {
  if (kind === "invoice") {
    return `RL-${ddmmyy(isoDate)}${String(seq).padStart(3, "0")}`;
  }
  return `AKT № ${String(seq).padStart(2, "0")}`;
}
