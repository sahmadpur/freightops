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
    <div className="inline-flex items-center rounded-full border border-edge-chip bg-surface-card p-[2px]">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => choose(l)}
          aria-pressed={l === current}
          aria-label={`Switch to ${LOCALE_NAMES[l]}`}
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
            l === current
              ? "bg-brand text-brand-pale"
              : "text-ink-soft hover:text-brand"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
