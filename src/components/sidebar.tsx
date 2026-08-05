"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const LIBRARY_NAV = [
  { href: "/orders", key: "orders" },
  { href: "/dashboard", key: "dashboard" },
  { href: "/accounts", key: "accounts" },
  { href: "/carriers", key: "carriers" },
  { href: "/customs", key: "customs" },
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
        className={`mx-2 flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] transition-colors ${
          active
            ? "bg-sidebar-chip font-medium text-white shadow-[inset_0_0_18px_rgba(142,174,255,0.5)]"
            : "text-sidebar-fg-soft hover:bg-surface-chip-active hover:text-brand"
        }`}
      >
        {label}
      </Link>
    );
  };

  const sectionLabel = (label: string) => (
    <div className="px-[18px] pb-1.5 pt-4 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-soft/70">
      {label}
    </div>
  );

  return (
    <aside className="hidden w-[210px] shrink-0 flex-col border-r border-edge-soft bg-sidebar md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-[18px] pb-4 pt-4">
        <BrandMark />
        <span className="font-display text-[17px] font-medium tracking-[-0.03em] text-sidebar-fg">
          Freight<span className="text-brand">Ops</span>
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto pb-2">
        {sectionLabel(t("sectionLibrary"))}
        {LIBRARY_NAV.map((n) => item(n.href, t(n.key)))}
        {isAdmin && (
          <>
            {sectionLabel(t("sectionManage"))}
            {ADMIN_NAV.map((n) => item(n.href, t(n.key)))}
          </>
        )}
      </nav>

      <div className="border-t border-edge-soft px-[18px] py-3 text-[10.5px] leading-relaxed text-ink-soft/70">
        Freight forwarding operations
      </div>
    </aside>
  );
}

/**
 * Below `md` the rail is hidden and the same routes ride in a scrollable strip
 * under the top bar, so a phone gets the full width for the record itself.
 */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const links = isAdmin ? [...LIBRARY_NAV, ...ADMIN_NAV] : LIBRARY_NAV;

  return (
    <nav className="flex gap-1.5 overflow-x-auto border-b border-edge-soft bg-sidebar px-3 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {links.map(({ href, key }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${
              active
                ? "bg-sidebar-chip font-medium text-white"
                : "text-sidebar-fg-soft hover:bg-surface-chip-active hover:text-brand"
            }`}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Freight-box mark on a blue tile. */
function BrandMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-brand text-white shadow-[inset_0_0_18px_rgba(142,174,255,0.55)]">
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
