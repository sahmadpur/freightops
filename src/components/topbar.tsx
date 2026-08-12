"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { Theme } from "@/lib/theme";

export function Topbar({ userName, theme }: { userName: string; theme: Theme }) {
  const t = useTranslations("common");
  const ts = useTranslations("search");
  const router = useRouter();

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex items-center gap-3 border-b border-edge-soft bg-surface px-4 py-2.5 md:px-6">
      {/* The rail carries the wordmark from md up; on a phone it lives here. */}
      <span className="flex items-center gap-2 md:hidden">
        <Image src="/all-in-logo.png" alt="" width={22} height={21} />
        <span className="font-display text-[15px] font-extrabold tracking-[-0.04em] text-brand-deep">
          All In <span className="font-medium text-ink-soft">Logistics</span>
        </span>
      </span>
      {/* Global search across requests and orders — a plain GET form, so the
          results page is a shareable URL like every other list in the app. */}
      <form action="/search" className="flex-1">
        <input
          type="search"
          name="q"
          placeholder={ts("placeholder")}
          aria-label={ts("title")}
          className="w-full max-w-sm rounded-full border border-edge-chip bg-transparent px-4 py-[7px] text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand"
        />
      </form>
      <ThemeSwitcher theme={theme} />
      <LanguageSwitcher />
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-brand font-display text-[10.5px] font-bold text-brand-pale"
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="hidden text-[12.5px] text-ink sm:inline">
          {userName}
        </span>
      </div>
      <button
        onClick={async () => {
          try {
            await signOut();
          } catch (err) {
            console.error("Sign-out failed:", err);
          }
          router.push("/sign-in");
        }}
        className="btn-secondary"
      >
        {t("signOut")}
      </button>
    </header>
  );
}
