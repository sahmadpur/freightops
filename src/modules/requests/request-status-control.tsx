"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { REQUEST_STATUSES } from "@/lib/request-status";
import { LOST_REASONS, requiresNote } from "@/lib/lost-reason";
import { changeRequestStatus } from "./actions";
import type { ActionResult } from "./schema";

/**
 * The commercial status control. Two things make it more than a dropdown:
 *
 * - `lost` reveals the mandatory reason (§12), and `other` reveals the note, so
 *   a request can never reach the Lost state with nothing to explain it;
 * - `won` is not offered at all — it is what creating the order sets, so a won
 *   request always has the order to prove it (§14).
 */
export function RequestStatusControl({
  requestId,
  current,
  lostReason: currentReason,
  lostReasonNote: currentNote,
}: {
  requestId: string;
  current: string;
  lostReason: string | null;
  lostReasonNote: string | null;
}) {
  const t = useTranslations();
  const tr = useTranslations("requests");
  const tf = useTranslations("fields");
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [reason, setReason] = useState(currentReason ?? "");
  const [note, setNote] = useState(currentNote ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const isLost = status === "lost";

  async function save() {
    setPending(true);
    const r = await changeRequestStatus(requestId, {
      status,
      lostReason: isLost ? reason : "",
      lostReasonNote: isLost ? note : "",
    });
    setPending(false);
    setResult(r);
    if (r.ok) router.refresh();
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const unchanged = status === current && reason === (currentReason ?? "");

  return (
    <div className="space-y-2">
      <select
        className={inputCls}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        aria-label={tr("updateStatus")}
      >
        {REQUEST_STATUSES.filter((s) => s !== "won" || current === "won").map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>

      {isLost && (
        <>
          <select
            className={inputCls}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label={tf("lostReason")}
          >
            <option value="">{tf("lostReason")}…</option>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`lostReason.${r}`)}
              </option>
            ))}
          </select>
          {fe.lostReason && (
            <p className="text-[11.5px] text-[rgb(var(--danger-fg))]">{fe.lostReason[0]}</p>
          )}
          {requiresNote(reason as (typeof LOST_REASONS)[number]) && (
            <>
              <textarea
                rows={2}
                className={inputCls}
                placeholder={tf("lostReasonNote")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {fe.lostReasonNote && (
                <p className="text-[11.5px] text-[rgb(var(--danger-fg))]">{fe.lostReasonNote[0]}</p>
              )}
            </>
          )}
        </>
      )}

      {/* §24: the server names the fields that block the transition, and each
          one is a `fields.*` key, so the list reads as labels rather than columns. */}
      {result && !result.ok && result.error === "incomplete" && (
        <p className="text-[11.5px] text-[rgb(var(--danger-fg))]">
          {tr("incompleteForStatus")}{" "}
          {(fe.status ?? []).map((f) => (t.has(`fields.${f}`) ? t(`fields.${f}`) : f)).join(", ")}
        </p>
      )}
      {result && !result.ok && result.error === "convert_instead" && (
        <p className="text-[11.5px] text-[rgb(var(--danger-fg))]">{tr("convertInstead")}</p>
      )}

      <button type="button" onClick={save} disabled={pending || unchanged} className="btn-primary w-full">
        {pending ? t("actions.saving") : tr("updateStatus")}
      </button>
    </div>
  );
}
