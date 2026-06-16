"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const LIBRARY_NAV = [
  { href: "/orders", key: "orders" },
  { href: "/dashboard", key: "dashboard" },
  { href: "/accounts", key: "accounts" },
  { href: "/carriers", key: "carriers" },
  { href: "/transportation", key: "transportation" },
  { href: "/finance", key: "finance" },
  { href: "/documents", key: "documents" },
] as const;

const ADMIN_NAV = [
  { href: "/admin/users", key: "users" },
  { href: "/admin/audit", key: "audit" },
] as const;

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const item = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 border-l-[3px] py-2.5 pl-[15px] pr-[18px] text-[13px] transition-colors ${
          active
            ? "border-brand-accent bg-white/[0.13] text-sidebar-fg"
            : "border-transparent text-sidebar-fg-soft hover:bg-white/[0.07]"
        }`}
      >
        {label}
      </Link>
    );
  };

  const eyebrow = (label: string) => (
    <div className="px-[18px] pb-1 pt-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-accent">
      {label}
    </div>
  );

  return (
    <aside className="flex w-[210px] shrink-0 flex-col bg-sidebar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Wordmark — split-color superscript treatment */}
      <div className="flex items-center gap-2.5 px-[18px] pb-4 pt-4">
        <BrandMark />
        <span className="text-[16px] font-semibold tracking-tight text-sidebar-fg">
          Freight
          <sup className="ml-0.5 align-super font-mono text-[10px] text-brand-accent">
            Ops
          </sup>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto pb-2">
        {eyebrow(t("sectionLibrary"))}
        {LIBRARY_NAV.map((n) => item(n.href, t(n.key)))}
        {isAdmin && (
          <>
            {eyebrow(t("sectionManage"))}
            {ADMIN_NAV.map((n) => item(n.href, t(n.key)))}
          </>
        )}
      </nav>

      {/* Ledger footer rule */}
      <div className="border-t border-white/10 px-[18px] py-3">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-sidebar-fg-soft/70">
          Freight Forwarding
        </div>
        <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-brand-accent">
          Manifest · 2026
        </div>
      </div>
    </aside>
  );
}

/** Stamped freight-box mark on a lime square — the desk's seal. */
function BrandMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-brand-accent text-brand-deep">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5z" />
        <path d="M3 7.5 12 12l9-4.5M12 12v9" />
      </svg>
    </span>
  );
}
