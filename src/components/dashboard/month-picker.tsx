"use client";

import { useRouter } from "next/navigation";
import { inputCls } from "@/components/ui/form";

/**
 * Month selector for the dashboard and the finance page (BRD 4.6). Navigates
 * rather than holding state, so the selected period is part of the URL and
 * shareable.
 */
export function MonthPicker({
  month,
  label,
  basePath = "/dashboard",
}: {
  month: string;
  label: string;
  basePath?: string;
}) {
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
        onChange={(e) => router.push(`${basePath}?month=${e.target.value}`)}
      />
    </label>
  );
}
