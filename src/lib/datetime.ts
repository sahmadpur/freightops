/**
 * Date/time display, formatted the same in every runtime.
 *
 * Two things make a naive `Intl.DateTimeFormat(locale, …)` call unsafe in a
 * component that renders on both the server and the client:
 *
 * 1. Chromium ships no Azerbaijani date data — it answers "2026 M08 5 12:34"
 *    where Node's ICU answers "5 avq 2026, 12:34". Same code, two strings, so
 *    hydration fails and AZ users read a machine format. We compose the
 *    Azerbaijani form ourselves from numeric parts plus the month table below.
 * 2. Without an explicit time zone, the server formats in the container's zone
 *    and the browser in the visitor's. `TIME_ZONE` pins both to the operating
 *    zone of the business, which is also what a waybill's timestamps mean.
 *
 * Every other locale goes through `Intl` — Node and Chromium agree on en/ru.
 */

/** The desk's operating zone: all record timestamps are read in Baku time. */
export const TIME_ZONE = "Asia/Baku";

/** Azerbaijani abbreviated months, matching CLDR (`Intl` `month: "short"`). */
const AZ_MONTHS_SHORT = [
  "yan",
  "fev",
  "mar",
  "apr",
  "may",
  "iyn",
  "iyl",
  "avq",
  "sen",
  "okt",
  "noy",
  "dek",
];

type Style = "medium" | "short";

function isAz(locale: string): boolean {
  return locale === "az" || locale.startsWith("az-");
}

/** Numeric date parts in a fixed zone, via a locale every runtime carries. */
function partsIn(value: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/**
 * "5 avq 2026, 12:34" (medium) or "05.08.26, 12:34" (short) in Azerbaijani;
 * the matching `Intl` output in every other locale.
 */
export function formatDateTime(
  value: Date | string | number,
  locale: string,
  style: Style = "medium",
): string {
  const date = value instanceof Date ? value : new Date(value);

  if (isAz(locale)) {
    const p = partsIn(date);
    const time = `${p.hour}:${p.minute}`;
    if (style === "short") {
      return `${p.day}.${p.month}.${p.year.slice(2)}, ${time}`;
    }
    const month = AZ_MONTHS_SHORT[Number(p.month) - 1];
    return `${Number(p.day)} ${month} ${p.year}, ${time}`;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: style,
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(date);
}
