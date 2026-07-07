"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = { ok: boolean; error?: string };

/**
 * Archive/restore control backed by a bound server action (e.g.
 * `archiveOrder.bind(null, id)`). Confirms before archiving; on success it
 * redirects (archive) or refreshes (restore). Surfaces the `has_orders` guard.
 */
export function ArchiveButton({
  action,
  mode,
  label,
  confirm,
  hasOrdersError,
  redirectTo,
}: {
  action: () => Promise<Result>;
  mode: "archive" | "restore";
  label: string;
  confirm?: string;
  hasOrdersError?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (confirm && !window.confirm(confirm)) return;
    setPending(true);
    setError(null);
    const r = await action();
    setPending(false);
    if (r.ok) {
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } else {
      setError(r.error === "has_orders" ? (hasOrdersError ?? "Cannot archive") : "Failed");
    }
  }

  const cls =
    mode === "archive"
      ? "text-[rgb(var(--danger-fg))] hover:underline"
      : "text-brand hover:underline";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={onClick} disabled={pending} className={`text-sm ${cls}`}>
        {label}
      </button>
      {error && <span className="text-xs text-[rgb(var(--danger-fg))]">{error}</span>}
    </span>
  );
}
