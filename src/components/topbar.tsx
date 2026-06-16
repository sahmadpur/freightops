"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Topbar({ userName }: { userName: string }) {
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
    <header className="flex items-center gap-3 border-b border-edge-soft bg-surface-card px-[22px] py-2">
      <div className="flex-1" />
      <LanguageSwitcher />
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-chip text-[11px] font-semibold text-brand-pale"
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
