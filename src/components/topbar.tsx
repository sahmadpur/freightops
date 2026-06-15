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
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white/80 px-5 py-2.5 backdrop-blur-sm">
      <div className="flex-1" />
      <LanguageSwitcher />
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-[11px] font-bold text-white"
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="text-sm font-medium text-slate-700">{userName}</span>
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
        className="btn-secondary px-3 py-1.5"
      >
        {t("signOut")}
      </button>
    </header>
  );
}
