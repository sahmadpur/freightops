import { convertUsdToAzn, formatMoney, formatMoneyAzn } from "@/lib/money";

/**
 * Money in both currencies: USD (primary, stored) on top, the AZN equivalent —
 * converted at the order's exchange rate (AZN per 1 USD) — beneath. Falls back
 * to USD-only when the order has no rate. See requirement #11.
 */
export function MoneyDual({
  usdCents,
  rate,
  className = "",
}: {
  usdCents: number;
  rate: string | number | null | undefined;
  className?: string;
}) {
  const aznCents = convertUsdToAzn(usdCents, rate);
  return (
    <span className={`inline-flex flex-col leading-tight ${className}`}>
      <span className="tabular-nums">{formatMoney(usdCents)}</span>
      {aznCents !== null && (
        <span className="text-[10px] text-ink-soft tabular-nums">{formatMoneyAzn(aznCents)}</span>
      )}
    </span>
  );
}
