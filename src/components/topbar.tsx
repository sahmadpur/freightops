"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Topbar({ userName }: { userName: string }) {
  const t = useTranslations("common");
  const router = useRouter();

  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-2.5">
      <div className="flex-1" />
      <LanguageSwitcher />
      <span className="text-sm text-slate-600">{userName}</span>
      <button
        onClick={async () => {
          try {
            await signOut();
          } catch (err) {
            console.error("Sign-out failed:", err);
          }
          router.push("/sign-in");
        }}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        {t("signOut")}
      </button>
    </header>
  );
}
