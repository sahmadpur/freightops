"use client";

import { useTranslations } from "next-intl";

/**
 * Hue-coded shipment stages: cool blues while the load is being arranged,
 * amber in motion, rose at the border/customs, green once it lands. The hue
 * is information — it lets a table be scanned without reading the labels.
 */
const STATUS_COLORS: Record<string, string> = {
  created: "bg-[#eef3ff] text-[#2049c4]",
  waiting_pickup: "bg-[#f1f3f7] text-[#4d5566]",
  received: "bg-[#eceaff] text-[#4436b8]",
  internal_transit: "bg-[#e7f4fb] text-[#0f5f80]",
  loaded: "bg-[#e6f6ef] text-[#12775a]",
  transit: "bg-[#fff6df] text-[#8a5a06]",
  at_border: "bg-[#feeee6] text-[#9a4419]",
  at_customs: "bg-[#fdeaf1] text-[#96305a]",
  arrived: "bg-[#edf7e3] text-[#3d6b16]",
  delivered: "bg-[#dff3e9] text-[#12775a]",
  closed: "bg-[#f1f1f1] text-[#5c5c5c]",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
        STATUS_COLORS[status] ?? "bg-[#f1f1f1] text-[#5c5c5c]"
      }`}
    >
      {t(status)}
    </span>
  );
}
