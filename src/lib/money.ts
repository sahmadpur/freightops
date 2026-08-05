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

/** Symbol per supported currency; anything unknown falls back to its code. */
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  AZN: "₼",
  TRY: "₺",
  RUB: "₽",
};

function groupCents(cents: number): { sign: string; formatted: string } {
  const sign = cents < 0 ? "-" : "";
  const formatted = (Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return { sign, formatted };
}

/**
 * Cents → a display string with a currency symbol and thousands separators,
 * e.g. 420000 → "$4,200.00", or "TRY 4,200.00" for a currency with no symbol.
 */
export function formatMoney(cents: number, currency: string = "USD"): string {
  const { sign, formatted } = groupCents(cents);
  const symbol = CURRENCY_SYMBOL[currency];
  return symbol ? `${sign}${symbol}${formatted}` : `${sign}${currency} ${formatted}`;
}

/** Cents → a display string with the manat symbol, e.g. 714000 → "₼7,140.00". */
export function formatMoneyAzn(cents: number): string {
  return formatMoney(cents, "AZN");
}

/**
 * Convert cents in an order's currency to AZN cents at `rate` (AZN per 1 unit
 * of that currency). Returns null when no rate is set, so callers can fall back
 * to showing the original currency alone.
 */
export function convertToAzn(cents: number, rate: string | number | null | undefined): number | null {
  if (rate === null || rate === undefined || rate === "") return null;
  const r = typeof rate === "string" ? Number(rate) : rate;
  if (!Number.isFinite(r) || r <= 0) return null;
  return Math.round(cents * r);
}
