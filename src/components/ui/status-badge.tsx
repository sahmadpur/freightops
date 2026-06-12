"use client";

import { useTranslations } from "next-intl";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-[#ddeaf9] text-[#0c447c]",
  received: "bg-[#e3e0f7] text-[#3b2f7e]",
  internal_transit: "bg-[#d8eef7] text-[#0b4a63]",
  loaded: "bg-[#d4f2e7] text-[#085041]",
  transit: "bg-[#fdefd1] text-[#633806]",
  at_border: "bg-[#fde8df] text-[#712b13]",
  at_customs: "bg-[#fae0ea] text-[#72243e]",
  arrived: "bg-[#e0f0d0] text-[#27500a]",
  delivered: "bg-[#c8e8d8] text-[#085041]",
  closed: "bg-[#e8e8e8] text-[#444444]",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
        STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {t(status)}
    </span>
  );
}
