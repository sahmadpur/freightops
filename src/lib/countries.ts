/**
 * ISO 3166-1 alpha-2 country codes, used for order route from/to.
 *
 * Only the codes are stored here: the flag emoji is derived arithmetically from
 * the code (regional indicator symbols), and the display name comes from
 * `Intl.DisplayNames`, so country names never enter `messages/*.json` and are
 * localized for free in EN/RU/AZ.
 */
import { AZ_REGION_NAMES } from "./country-names-az";

const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ " +
  "BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
  "DE DJ DK DM DO DZ EC EE EG EH ER ES ET " +
  "FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY " +
  "HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT " +
  "JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ " +
  "LA LB LC LI LK LR LS LT LU LV LY " +
  "MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
  "NA NC NE NF NG NI NL NO NP NR NU NZ OM " +
  "PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ " +
  "TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";

export const COUNTRY_CODES: readonly string[] = CODES.split(" ");

const CODE_SET = new Set(COUNTRY_CODES);

/** True when `code` is a country code we know about. */
export function isCountryCode(code: string): boolean {
  return CODE_SET.has(code);
}

/**
 * Flag emoji for an alpha-2 code: each letter maps to its regional indicator
 * symbol (U+1F1E6 is 'A'). Returns "" for anything that isn't two A–Z letters.
 */
export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  const base = 0x1f1e6 - 65;
  return String.fromCodePoint(base + code.charCodeAt(0), base + code.charCodeAt(1));
}

/**
 * Localized country name. Falls back to the raw code where `Intl.DisplayNames`
 * has no entry (or isn't available, e.g. a stripped-down runtime).
 *
 * Azerbaijani comes from our own table: Chromium has no `az` region data and
 * falls back to English, while Node's ICU returns real Azerbaijani — computing
 * it at runtime would make server and client HTML disagree. See
 * `country-names-az.ts`.
 */
export function countryName(code: string, locale: string): string {
  if (locale === "az" || locale.startsWith("az-")) {
    return AZ_REGION_NAMES[code] ?? code;
  }
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "🇩🇪 Germany" — what the route dropdowns and detail rows render. */
export function countryLabel(code: string | null | undefined, locale: string): string | null {
  if (!code) return null;
  const flag = countryFlag(code);
  const name = countryName(code, locale);
  return flag ? `${flag} ${name}` : name;
}

/**
 * "🇩🇪 Germany → 🇦🇿 Azerbaijan" — the route line that replaced free-text route.
 * Renders whichever end is known; null when neither is. Pass `flags: false`
 * where emoji won't render (generated PDFs).
 */
export function routeLabel(
  from: string | null | undefined,
  to: string | null | undefined,
  locale: string,
  { flags = true }: { flags?: boolean } = {},
): string | null {
  const side = (code: string | null | undefined) => {
    if (!code) return null;
    const name = countryName(code, locale);
    return flags && countryFlag(code) ? `${countryFlag(code)} ${name}` : name;
  };
  const a = side(from);
  const b = side(to);
  if (a && b) return `${a} → ${b}`;
  return a ?? b ?? null;
}

/** Options for a Combobox, sorted by localized name. */
export function countryOptions(locale: string): { value: string; label: string; prefix: string }[] {
  return COUNTRY_CODES.map((code) => ({
    value: code,
    label: countryName(code, locale),
    prefix: countryFlag(code),
  })).sort((a, b) => a.label.localeCompare(b.label, locale));
}
