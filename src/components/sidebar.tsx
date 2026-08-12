"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NavIcon } from "@/components/nav-icons";

const LIBRARY_NAV = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/requests", key: "requests" },
  { href: "/orders", key: "orders" },
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

  /**
   * The signature element. The active route is a solid ink pill — black on a
   * light rail, white on a dark one — carrying a paper label and the one mint
   * icon in the interface. Everything else in the rail is drawn, not filled.
   */
  const item = (href: string, label: string, icon: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`mx-2.5 flex items-center gap-3 rounded-full px-3 py-2 transition-colors ${
          active
            ? "bg-sidebar-chip text-brand-pale"
            : "text-sidebar-fg-soft hover:bg-surface-chip-active hover:text-sidebar-fg"
        }`}
      >
        <NavIcon
          name={icon}
          className={active ? "text-accent-on-brand" : "text-current"}
        />
        <span
          className={`font-display text-[13px] tracking-[-0.01em] ${
            active ? "font-bold" : "font-medium"
          }`}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <aside className="hidden w-[212px] shrink-0 flex-col border-r border-edge-soft bg-sidebar md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <BrandMark />
        <span className="font-display text-[16px] font-extrabold leading-[1.1] tracking-[-0.04em] text-sidebar-fg">
          All In <span className="font-medium text-ink-soft">Logistics</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pb-3">
        <div className="eyebrow px-5 pb-2 pt-2">{t("sectionLibrary")}</div>
        {LIBRARY_NAV.map((n) => item(n.href, t(n.key), n.key))}
        {isAdmin && (
          <>
            <div className="eyebrow px-5 pb-2 pt-5">{t("sectionManage")}</div>
            {ADMIN_NAV.map((n) => item(n.href, t(n.key), n.key))}
          </>
        )}
      </nav>

      <div className="border-t border-edge-soft px-5 py-4 text-[11px] leading-relaxed text-ink-faint">
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
    <nav className="flex gap-2 overflow-x-auto border-b border-edge-soft bg-sidebar px-3 py-2.5 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {links.map(({ href, key }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-display text-[12.5px] tracking-[-0.01em] transition-colors ${
              active
                ? "bg-sidebar-chip font-bold text-brand-pale"
                : "border border-edge-chip font-medium text-sidebar-fg-soft"
            }`}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

/** The company mark. */
function BrandMark() {
  return <Image src="/all-in-logo.png" alt="" width={26} height={25} priority />;
}
