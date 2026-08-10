/**
 * Incoterms 2020, plus the escape hatch the specification asks for (§10) when a
 * client's terms don't match any of them. Client-safe, so forms can import it
 * without pulling drizzle into the browser bundle; the `incoterms` pgEnum is
 * built from this list.
 *
 * The codes are the labels — they are the same in every language, which is the
 * point of Incoterms, so they never enter the message files.
 */
export const INCOTERMS = [
  "EXW",
  "FCA",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
  "OTHER",
] as const;

export type Incoterm = (typeof INCOTERMS)[number];

/** The one value that carries no standard meaning, so it wants the place field spelled out. */
export function isFreeformIncoterm(value: string): boolean {
  return value === "OTHER";
}
