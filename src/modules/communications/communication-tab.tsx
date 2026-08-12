"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Field, inputCls } from "@/components/ui/form";
import { SectionRule } from "@/components/ui/record";
import { formatDateTime } from "@/lib/datetime";
import { findLinkableMessages, linkMessage, logMessage, unlinkMessage } from "./actions";
import type { MessageRow } from "./queries";
import type { ActionResult } from "./schema";

const CHANNELS = ["phone", "whatsapp", "other"] as const;
const DIRECTIONS = ["incoming", "outgoing"] as const;

/**
 * The §17.5 / §18 Communication tab.
 *
 * The Outlook sync is not built yet, so today this shows manually logged calls
 * and WhatsApp exchanges and lets a user attach an existing message. When mail
 * sync lands it writes to the same tables and appears here with no UI change —
 * which is the point of building the seam first.
 */
export function CommunicationTab({
  requestId,
  messages,
}: {
  requestId: string;
  messages: MessageRow[];
}) {
  const t = useTranslations("communications");
  const tf = useTranslations("fields");
  const ta = useTranslations("actions");
  const locale = useLocale();
  const router = useRouter();

  const [v, setV] = useState({ channel: "phone", direction: "incoming", subject: "", body: "", occurredAt: "" });
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ id: string; label: string }[]>([]);

  const set = (patch: Partial<typeof v>) => setV((s) => ({ ...s, ...patch }));

  async function submit() {
    setPending(true);
    const r = await logMessage(requestId, v);
    setPending(false);
    setResult(r);
    if (r.ok) {
      setV({ channel: v.channel, direction: v.direction, subject: "", body: "", occurredAt: "" });
      router.refresh();
    }
  }

  async function search(next: string) {
    setQuery(next);
    setHits(next.trim().length < 2 ? [] : await findLinkableMessages(requestId, next));
  }

  async function attach(messageId: string) {
    await linkMessage(requestId, { messageId });
    setQuery("");
    setHits([]);
    router.refresh();
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <div className="max-w-3xl space-y-7">
      <section>
        <SectionRule>{t("thread")}</SectionRule>
        {messages.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="rounded-control border border-edge-soft bg-surface-hover p-3">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[11.5px] text-ink-soft">
                  <span>
                    <span className="font-medium text-ink">
                      {t(`channel.${m.channel}`)} · {t(`direction.${m.direction}`)}
                    </span>
                    {m.fromEmail && <span> · {m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail}</span>}
                    {m.to.length > 0 && <span> · {tf("emails")}: {m.to.join(", ")}</span>}
                    {m.cc.length > 0 && <span> · CC: {m.cc.join(", ")}</span>}
                  </span>
                  <span className="font-mono">{formatDateTime(m.at, locale, "short")}</span>
                </div>
                {m.subject && <div className="text-[13px] font-medium text-ink">{m.subject}</div>}
                {m.bodyText && <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink">{m.bodyText}</p>}
                {m.attachments.length > 0 && (
                  <div className="mt-2 text-[11.5px] text-ink-soft">
                    {t("attachments")}: {m.attachments.map((a) => a.fileName).join(", ")}
                  </div>
                )}
                {/* §17.8: one email can belong to several requests. Say so, so
                    nobody thinks they are looking at a private thread. */}
                {m.alsoLinkedTo.length > 0 && (
                  <div className="mt-2 text-[11.5px] text-ink-soft">
                    {t("alsoLinkedTo")}:{" "}
                    {m.alsoLinkedTo.map((r) => (
                      <Link key={r.id} href={`/requests/${r.id}`} className="mr-2 text-brand hover:underline">
                        {r.number}
                      </Link>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await unlinkMessage(requestId, m.id);
                    router.refresh();
                  }}
                  className="mt-2 text-[11.5px] text-[rgb(var(--danger-fg))] hover:underline"
                >
                  {t("unlink")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionRule>{t("linkExisting")}</SectionRule>
        <input
          className={inputCls}
          value={query}
          placeholder={t("linkPlaceholder")}
          onChange={(e) => search(e.target.value)}
        />
        {hits.length > 0 && (
          <ul className="mt-2 divide-y divide-edge-soft rounded-control border border-edge-chip">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => attach(h.id)}
                  className="block w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-hover"
                >
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionRule>{t("logManual")}</SectionRule>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">
          <Field label={t("channelLabel")} error={fe.channel}>
            <select className={inputCls} value={v.channel} onChange={(e) => set({ channel: e.target.value })}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{t(`channel.${c}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("directionLabel")} error={fe.direction}>
            <select className={inputCls} value={v.direction} onChange={(e) => set({ direction: e.target.value })}>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>{t(`direction.${d}`)}</option>
              ))}
            </select>
          </Field>
          {/* When it happened, not when it was typed up — same distinction the
              request makes between received_at and created_at. */}
          <Field label={t("occurredAt")} error={fe.occurredAt}>
            <input
              type="datetime-local"
              className={inputCls}
              value={v.occurredAt}
              onChange={(e) => set({ occurredAt: e.target.value })}
            />
          </Field>
        </div>
        <Field label={tf("emailSubject")} error={fe.subject}>
          <input className={inputCls} value={v.subject} onChange={(e) => set({ subject: e.target.value })} />
        </Field>
        <Field label={t("summary")} error={fe.body}>
          <textarea rows={4} className={inputCls} value={v.body} onChange={(e) => set({ body: e.target.value })} />
        </Field>
        <button type="button" onClick={submit} disabled={pending || !v.body.trim()} className="btn-primary">
          {pending ? ta("saving") : t("logIt")}
        </button>
      </section>
    </div>
  );
}
