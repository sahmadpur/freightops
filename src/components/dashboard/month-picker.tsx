"use client";

import { useRouter } from "next/navigation";
import { inputCls } from "@/components/ui/form";

/**
 * Month selector for the dashboard (BRD 4.6). Navigates rather than holding
 * state, so the selected period is part of the URL and shareable.
 */
export function MonthPicker({ month, label }: { month: string; label: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2">
      <span className="text-[11.5px] font-medium text-ink-soft">
        {label}
      </span>
      <input
        type="month"
        className={`${inputCls} w-44`}
        value={month}
        onChange={(e) => router.push(`/dashboard?month=${e.target.value}`)}
      />
    </label>
  );
}
