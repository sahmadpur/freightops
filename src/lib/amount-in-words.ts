/**
 * Amount-in-words for generated invoices/ACTs, e.g. 71400 cents in AZN/az →
 * "Yeddi yüz on dörd manat 00 qəpik". The integer (major) part is spelled out;
 * the fractional (minor) part is shown as two digits followed by its noun, the
 * convention on the client's real templates.
 *
 * Three languages: Azerbaijani (authoritative — matches the client documents),
 * Russian (with plural/gender agreement) and English. Currency: AZN or USD.
 */

export const DOC_CURRENCIES = ["AZN", "USD"] as const;
export type DocCurrency = (typeof DOC_CURRENCIES)[number];

export type WordsLang = "en" | "ru" | "az";

// ---------------------------------------------------------------- English ----

const EN_ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const EN_SCALE = ["", "thousand", "million", "billion", "trillion"];

function enBelow1000(n: number): string {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) out.push(`${EN_ONES[h]} hundred`);
  if (r < 20) {
    if (r) out.push(EN_ONES[r]);
  } else {
    const t = Math.floor(r / 10);
    const o = r % 10;
    out.push(o ? `${EN_TENS[t]}-${EN_ONES[o]}` : EN_TENS[t]);
  }
  return out.join(" ");
}

function enInt(n: number): string {
  if (n === 0) return "zero";
  const chunks = chunk1000(n);
  const out: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i] === 0) continue;
    out.push(enBelow1000(chunks[i]) + (EN_SCALE[i] ? ` ${EN_SCALE[i]}` : ""));
  }
  return out.join(" ");
}

// ------------------------------------------------------------ Azerbaijani ----

const AZ_ONES = ["", "bir", "iki", "üç", "dörd", "beş", "altı", "yeddi", "səkkiz", "doqquz"];
const AZ_TENS = ["", "on", "iyirmi", "otuz", "qırx", "əlli", "altmış", "yetmiş", "səksən", "doxsan"];
const AZ_SCALE = ["", "min", "milyon", "milyard", "trilyon"];

function azBelow1000(n: number): string {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  // 100 → "yüz" (no leading "bir"); 200 → "iki yüz".
  if (h) out.push(h === 1 ? "yüz" : `${AZ_ONES[h]} yüz`);
  if (t) out.push(AZ_TENS[t]);
  if (o) out.push(AZ_ONES[o]);
  return out.join(" ");
}

function azInt(n: number): string {
  if (n === 0) return "sıfır";
  const chunks = chunk1000(n);
  const out: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i];
    if (c === 0) continue;
    // 1000 → "min" (no leading "bir"); the million group keeps "bir milyon".
    if (i === 1 && c === 1) out.push("min");
    else out.push(azBelow1000(c) + (AZ_SCALE[i] ? ` ${AZ_SCALE[i]}` : ""));
  }
  return out.join(" ");
}

// ---------------------------------------------------------------- Russian ----

const RU_ONES_M = [
  "", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать",
  "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
// Feminine differs only at 1 and 2 (одна/две); used for the thousands group.
const RU_ONES_F = RU_ONES_M.map((w, i) => (i === 1 ? "одна" : i === 2 ? "две" : w));
const RU_TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const RU_HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

const RU_SCALE: ({ forms: [string, string, string]; fem: boolean } | null)[] = [
  null,
  { forms: ["тысяча", "тысячи", "тысяч"], fem: true },
  { forms: ["миллион", "миллиона", "миллионов"], fem: false },
  { forms: ["миллиард", "миллиарда", "миллиардов"], fem: false },
];

/** Pick the Russian plural form for `n`: [1, 2–4, 0/5–20] agreement classes. */
function ruPlural(n: number, forms: [string, string, string]): string {
  const m100 = n % 100;
  const m10 = n % 10;
  if (m100 >= 11 && m100 <= 14) return forms[2];
  if (m10 === 1) return forms[0];
  if (m10 >= 2 && m10 <= 4) return forms[1];
  return forms[2];
}

function ruBelow1000(n: number, feminine: boolean): string {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) out.push(RU_HUNDREDS[h]);
  const ones = feminine ? RU_ONES_F : RU_ONES_M;
  if (r < 20) {
    if (r) out.push(ones[r]);
  } else {
    out.push(RU_TENS[Math.floor(r / 10)]);
    const o = r % 10;
    if (o) out.push(ones[o]);
  }
  return out.join(" ");
}

function ruInt(n: number): string {
  if (n === 0) return "ноль";
  const chunks = chunk1000(n);
  const out: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i];
    if (c === 0) continue;
    const sc = RU_SCALE[i];
    out.push(ruBelow1000(c, sc?.fem ?? false));
    if (sc) out.push(ruPlural(c, sc.forms));
  }
  return out.join(" ");
}

// ------------------------------------------------------------- currency nouns

type NounFn = (n: number) => string;
type LangNouns = { major: NounFn; minor: NounFn };

const NOUNS: Record<DocCurrency, Record<WordsLang, LangNouns>> = {
  AZN: {
    az: { major: () => "manat", minor: () => "qəpik" },
    en: { major: () => "manat", minor: () => "qapik" },
    ru: {
      major: (n) => ruPlural(n, ["манат", "маната", "манатов"]),
      minor: (n) => ruPlural(n, ["гяпик", "гяпика", "гяпиков"]),
    },
  },
  USD: {
    az: { major: () => "dollar", minor: () => "sent" },
    en: { major: (n) => (n === 1 ? "dollar" : "dollars"), minor: (n) => (n === 1 ? "cent" : "cents") },
    ru: {
      major: (n) => ruPlural(n, ["доллар", "доллара", "долларов"]),
      minor: (n) => ruPlural(n, ["цент", "цента", "центов"]),
    },
  },
};

// ------------------------------------------------------------------- public

/** Split a non-negative integer into base-1000 chunks, least-significant first. */
function chunk1000(n: number): number[] {
  const chunks: number[] = [];
  let v = n;
  while (v > 0) {
    chunks.push(v % 1000);
    v = Math.floor(v / 1000);
  }
  return chunks;
}

function spellInt(n: number, lang: WordsLang): string {
  if (lang === "az") return azInt(n);
  if (lang === "ru") return ruInt(n);
  return enInt(n);
}

/**
 * Render integer `cents` as a legal amount-in-words string, capitalised, e.g.
 * (71400, "AZN", "az") → "Yeddi yüz on dörd manat 00 qəpik".
 */
export function amountInWords(cents: number, currency: DocCurrency, lang: WordsLang): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const nouns = NOUNS[currency][lang];
  const minorDigits = String(minor).padStart(2, "0");
  const sep = lang === "en" ? " and " : " ";
  const body = `${spellInt(major, lang)} ${nouns.major(major)}${sep}${minorDigits} ${nouns.minor(minor)}`;
  // Locale-aware so Azerbaijani "i" capitalises to the dotted "İ", not Latin "I".
  const capitalised = body.charAt(0).toLocaleUpperCase(lang) + body.slice(1);
  return neg ? `−${capitalised}` : capitalised;
}
