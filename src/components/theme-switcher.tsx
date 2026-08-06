"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { THEMES, type Theme } from "@/lib/theme";
import { setTheme } from "./theme-switcher.actions";

/**
 * Light / dark / system pill, twin of the language switcher. The choice is
 * applied to <html> here — nothing server-rendered depends on it — and
 * persisted to the `theme` cookie so the next request paints it directly.
 */
export function ThemeSwitcher({ theme }: { theme: Theme }) {
  const t = useTranslations("theme");
  const [current, setCurrent] = useState(theme);

  // Paint the choice immediately; THEME_SCRIPT keeps reading `themePref` to
  // follow the OS while "system" is selected.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.themePref = current;
    root.dataset.theme =
      current === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : current;
  }, [current]);

  function choose(next: Theme) {
    setCurrent(next);
    void setTheme(next);
  }

  return (
    <div className="inline-flex items-center rounded-full border border-edge-chip bg-surface-card p-[2px]">
      {THEMES.map((option) => (
        <button
          key={option}
          onClick={() => choose(option)}
          aria-pressed={option === current}
          aria-label={t(option)}
          title={t(option)}
          className={`flex h-[22px] w-[26px] items-center justify-center rounded-full transition-colors ${
            option === current
              ? "bg-brand text-brand-pale"
              : "text-ink-soft hover:text-brand"
          }`}
        >
          {ICONS[option]}
        </button>
      ))}
    </div>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[13px] w-[13px]",
  "aria-hidden": true,
};

const ICONS: Record<Theme, React.ReactNode> = {
  light: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </svg>
  ),
  dark: (
    <svg {...iconProps}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </svg>
  ),
  system: (
    <svg {...iconProps}>
      <rect x="2.5" y="4" width="19" height="12" rx="1.5" />
      <path d="M8.5 20h7M12 16v4" />
    </svg>
  ),
};
