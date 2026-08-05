import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fxRates } from "@/db/schema";
import { aznPerUnit, aznRateFor, cbarUrl, parseCbarRates, type CbarRate } from "@/lib/fx";

/** CBAR publishes daily, but walk back a few days in case of a gap. */
const MAX_LOOKBACK_DAYS = 7;
const FETCH_TIMEOUT_MS = 5000;

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function readCached(isoDate: string, code: string): Promise<string | null> {
  const [row] = await db
    .select({ nominal: fxRates.nominal, value: fxRates.value })
    .from(fxRates)
    .where(and(eq(fxRates.rateDate, isoDate), eq(fxRates.code, code)));
  if (!row) return null;
  return aznPerUnit({ nominal: row.nominal, value: Number(row.value) }).toFixed(4);
}

/**
 * Fetch one day's bulletin and cache every currency in it. Returns null when the
 * bulletin is unreachable or has no usable rows — never throws into the request
 * path, because the rate is always editable by hand.
 */
async function fetchAndStore(isoDate: string): Promise<Record<string, CbarRate> | null> {
  let xml: string;
  try {
    const res = await fetch(cbarUrl(isoDate), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    xml = await res.text();
  } catch (e) {
    console.error("[fx] CBAR fetch failed for", isoDate, e);
    return null;
  }

  const rates = parseCbarRates(xml);
  const codes = Object.keys(rates);
  if (codes.length === 0) return null;

  // The bulletin is immutable once published, so a conflict means someone else
  // cached the same day first — keep what's there.
  await db
    .insert(fxRates)
    .values(
      codes.map((code) => ({
        rateDate: isoDate,
        code,
        nominal: rates[code].nominal,
        value: rates[code].value.toFixed(4),
      })),
    )
    .onConflictDoNothing();

  return rates;
}

/**
 * AZN per 1 unit of `code` on `isoDate`, as a 4-decimal string. Reads the cache
 * first, then the CBAR bulletin, walking back day by day if a date has no
 * bulletin. Returns null when no rate can be established.
 */
export async function getAznRate(code: string, isoDate: string): Promise<string | null> {
  if (code === "AZN") return "1.0000";

  for (let i = 0; i <= MAX_LOOKBACK_DAYS; i++) {
    const date = shiftDays(isoDate, -i);
    const cached = await readCached(date, code);
    if (cached) return cached;
    const rates = await fetchAndStore(date);
    if (rates) {
      // The bulletin exists: if it doesn't quote this currency, no earlier one will.
      return aznRateFor(code, rates);
    }
  }
  return null;
}
