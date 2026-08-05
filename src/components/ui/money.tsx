import { convertToAzn, formatMoney, formatMoneyAzn } from "@/lib/money";

/**
 * Money in both currencies: the record's own currency on top, the AZN
 * equivalent — converted at its exchange rate (AZN per 1 unit) — beneath.
 * Falls back to the original currency alone when no rate is set, and shows
 * nothing extra when the record is already in AZN.
 */
export function MoneyDual({
  cents,
  currency = "USD",
  rate,
  className = "",
}: {
  cents: number;
  currency?: string;
  rate: string | number | null | undefined;
  className?: string;
}) {
  const aznCents = currency === "AZN" ? null : convertToAzn(cents, rate);
  return (
    <span className={`inline-flex flex-col leading-tight ${className}`}>
      <span className="tabular-nums">{formatMoney(cents, currency)}</span>
      {aznCents !== null && (
        <span className="text-[10px] text-ink-soft tabular-nums">{formatMoneyAzn(aznCents)}</span>
      )}
    </span>
  );
}
