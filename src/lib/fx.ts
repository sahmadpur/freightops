/**
 * Currencies an order or customs clearance can be quoted in. USD is the default
 * and AZN is the common denominator every aggregate is normalized to.
 */
export const ORDER_CURRENCIES = ["USD", "EUR", "AZN", "TRY", "RUB"] as const;

export type OrderCurrency = (typeof ORDER_CURRENCIES)[number];

export const DEFAULT_CURRENCY: OrderCurrency = "USD";

export function isOrderCurrency(code: string): code is OrderCurrency {
  return (ORDER_CURRENCIES as readonly string[]).includes(code);
}

export type CbarRate = {
  /** How many units of the currency `value` is quoted for (usually 1, sometimes 100). */
  nominal: number;
  /** AZN for `nominal` units. */
  value: number;
};

/**
 * The Central Bank of Azerbaijan publishes one bulletin per date at
 * `https://www.cbar.az/currencies/DD.MM.YYYY.xml`.
 */
export function cbarUrl(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `https://www.cbar.az/currencies/${d}.${m}.${y}.xml`;
}

const VALUTE_RE = /<Valute\s+Code="([A-Za-z]{3})"\s*>([\s\S]*?)<\/Valute>/g;
const NOMINAL_RE = /<Nominal>([\s\S]*?)<\/Nominal>/;
const VALUE_RE = /<Value>([\s\S]*?)<\/Value>/;

/**
 * Extract the currency rates from a CBAR bulletin.
 *
 * The document is small and rigidly structured, so a scoped regex pass beats
 * pulling in an XML parser. Bank-metal rows (Gold, Silver, …) quote their
 * nominal as "1 t.u." rather than a number and are skipped, as is anything
 * whose value doesn't parse.
 */
export function parseCbarRates(xml: string): Record<string, CbarRate> {
  const out: Record<string, CbarRate> = {};
  for (const match of xml.matchAll(VALUTE_RE)) {
    const code = match[1].toUpperCase();
    const body = match[2];
    const nominalRaw = body.match(NOMINAL_RE)?.[1]?.trim();
    const valueRaw = body.match(VALUE_RE)?.[1]?.trim();
    if (!nominalRaw || !valueRaw) continue;
    // "1 t.u." (troy ounce) — a bank metal, not a currency.
    if (!/^\d+(\.\d+)?$/.test(nominalRaw)) continue;
    const nominal = Number(nominalRaw);
    const value = Number(valueRaw);
    if (!Number.isFinite(nominal) || !Number.isFinite(value) || nominal <= 0 || value <= 0) continue;
    out[code] = { nominal, value };
  }
  return out;
}

/** AZN per 1 unit of the currency. */
export function aznPerUnit(rate: CbarRate): number {
  return rate.value / rate.nominal;
}

/**
 * The rate string stored on an order: AZN per 1 unit, to 4 decimals.
 * AZN itself is the identity — the bulletin never quotes it against itself.
 */
export function aznRateFor(code: string, rates: Record<string, CbarRate>): string | null {
  if (code === "AZN") return "1.0000";
  const rate = rates[code];
  if (!rate) return null;
  return aznPerUnit(rate).toFixed(4);
}
