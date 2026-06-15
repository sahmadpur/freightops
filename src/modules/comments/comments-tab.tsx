"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CommentRow } from "./queries";
import type { ActionResult } from "@/lib/forms";

export function CommentsTab({
  orderId,
  comments,
  currentUserId,
  sendAction,
}: {
  orderId: string;
  comments: CommentRow[];
  currentUserId: string;
  sendAction: (orderId: string, input: { body: string }) => Promise<ActionResult>;
}) {
  const t = useTranslations("comments");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Poll for new messages while the tab is open.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const r = await sendAction(orderId, { body: text });
      if (r.ok) {
        setBody("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="text-sm text-slate-400">{t("empty")}</p>
      ) : (
        <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {comments.map((c) => {
            const mine = c.authorId === currentUserId;
            return (
              <li key={c.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{c.body}</div>
                </div>
                <span className="mt-0.5 text-[11px] text-slate-400">
                  {c.authorName} ·{" "}
                  {/* Timestamp renders in the viewer's locale/timezone, so the SSR (UTC) and
                      client strings differ by design — suppress the expected hydration mismatch. */}
                  <time suppressHydrationWarning dateTime={new Date(c.createdAt).toISOString()}>
                    {new Date(c.createdAt).toLocaleString()}
                  </time>
                </span>
              </li>
            );
          })}
          <div ref={endRef} />
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("placeholder")}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || body.trim().length === 0}
          className="btn-primary"
        >
          {busy ? t("sending") : t("send")}
        </button>
      </div>
    </div>
  );
}
