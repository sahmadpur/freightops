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

  const item = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm ${
        pathname.startsWith(href)
          ? "bg-[#1a3a5c] text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <aside className="w-52 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200 font-semibold text-sm">
        FreightOps
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {STAFF_NAV.map((n) => item(n.href, t(n.key)))}
        {isAdmin && (
          <>
            <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-slate-400">
              System
            </div>
            {ADMIN_NAV.map((n) => item(n.href, t(n.key)))}
          </>
        )}
      </nav>
    </aside>
  );
}
