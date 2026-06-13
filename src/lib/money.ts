/** Parse a numeric(12,2) string (or null/"") into integer cents. Rounds to nearest cent. */
export function toCents(v: string | null | undefined): number {
  if (v === null || v === undefined || v.trim() === "") return 0;
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  // Add tiny epsilon to handle floating-point precision issues (e.g., 1.005 * 100 = 100.50000000000001)
  return Math.round(n * 100 + 1e-9);
}

/** Sum a list of numeric strings (null/empty count as 0) exactly, in cents. */
export function sumCents(values: (string | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + toCents(v), 0);
}

/** Cents → a plain 2-decimal string (no currency symbol), e.g. 420000 → "4200.00". */
export function centsToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Cents → a display string with $ and thousands separators, e.g. 420000 → "$4,200.00". */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${formatted}`;
}
