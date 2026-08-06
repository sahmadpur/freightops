"use client";

import { useTranslations } from "next-intl";
import { statusHue } from "@/lib/status-hue";

/**
 * Hue-coded shipment stages: cool blues while the load is being arranged,
 * amber in motion, rose at the border/customs, green once it lands. The hue
 * is information — it lets a table be scanned without reading the labels.
 *
 * The hue is a token (`--status-*`) and `.status-chip` mixes the fill and the
 * label out of it, so the badge follows the light/dark flip without a second
 * hand-written palette.
 */
export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  return (
    <span
      className="status-chip"
      style={{ "--status-hue": statusHue(status) } as React.CSSProperties}
    >
      {t(status)}
    </span>
  );
}
