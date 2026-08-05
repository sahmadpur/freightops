import { toCents } from "@/lib/money";

export type CustomsAmounts = {
  buyAmount: string | null;
  sellAmount: string | null;
};

export type CustomsTotals = {
  buyCents: number;
  sellCents: number;
  /** What the job earns: sell − buy. Negative when we are out of pocket. */
  marginCents: number;
};

/** Σbuy, Σsell and the margin between them, in integer minor units. */
export function customsTotals(items: CustomsAmounts[]): CustomsTotals {
  const buyCents = items.reduce((sum, i) => sum + toCents(i.buyAmount), 0);
  const sellCents = items.reduce((sum, i) => sum + toCents(i.sellAmount), 0);
  return { buyCents, sellCents, marginCents: sellCents - buyCents };
}
