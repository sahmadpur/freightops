"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALES, type Locale } from "@/i18n/locale";
import { setLocale } from "./language-switcher.actions";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Russian",
  az: "Azerbaijani",
};

export function LanguageSwitcher() {
  const current = useLocale();
  const router = useRouter();

  async function choose(locale: Locale) {
    await setLocale(locale);
    router.refresh();
  }

  return (
    <div className="flex gap-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => choose(l)}
          aria-pressed={l === current}
          aria-label={`Switch to ${LOCALE_NAMES[l]}`}
          className={`px-2.5 py-1 rounded-full text-xs border ${
            l === current
              ? "bg-indigo-600 text-white border-indigo-600"
              : "text-slate-500 border-slate-300"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
