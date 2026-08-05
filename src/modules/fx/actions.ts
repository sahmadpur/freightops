"use server";

import { requireArea } from "@/lib/session";
import { isOrderCurrency } from "@/lib/fx";
import { getAznRate } from "./queries";

/**
 * Look up the CBAR manat rate for a currency and date, for forms to pre-fill.
 * Returns null rather than an error when the rate can't be established — the
 * field stays editable either way.
 */
export async function fetchAznRate(code: string, isoDate: string): Promise<string | null> {
  await requireArea("staff");
  if (!isOrderCurrency(code)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  return getAznRate(code, isoDate);
}
