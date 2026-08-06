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
  const router = useRouter();

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex items-center gap-3 border-b border-edge-soft bg-surface-card px-4 py-2 md:px-[22px]">
      {/* The rail carries the wordmark from md up; on a phone it lives here. */}
      <span className="flex items-center gap-2 md:hidden">
        <Image src="/all-in-logo.png" alt="" width={24} height={23} />
        <span className="font-display text-[16px] font-medium tracking-[-0.03em] text-brand-deep">
          All In <span className="text-ink-soft">Logistics</span>
        </span>
      </span>
      <div className="flex-1" />
      <ThemeSwitcher theme={theme} />
      <LanguageSwitcher />
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-chip-active text-[11px] font-semibold text-brand"
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="text-[12.5px] text-ink">{userName}</span>
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
