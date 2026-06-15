"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const STAFF_NAV = [
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
        className={`block rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
          active
            ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-btn"
            : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
        <BrandMark />
        <span className="text-sm font-extrabold tracking-tight text-slate-900">
          Freight<span className="text-gradient">Ops</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {STAFF_NAV.map((n) => item(n.href, t(n.key)))}
        {isAdmin && (
          <>
            <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              System
            </div>
            {ADMIN_NAV.map((n) => item(n.href, t(n.key)))}
          </>
        )}
      </nav>
    </aside>
  );
}

/** Gradient rounded-square mark with a freight-box glyph. */
function BrandMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_0_16px_rgba(79,70,229,0.4)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
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
