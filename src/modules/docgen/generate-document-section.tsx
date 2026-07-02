"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { inputCls } from "@/components/ui/form";
import { generateOrderDocument } from "./actions";

const KINDS = ["invoice", "act"] as const;
const LANGUAGES = ["en", "ru", "az"] as const;

type Kind = (typeof KINDS)[number];

export function GenerateDocumentSection({
  orderId,
  nextNumbers,
}: {
  orderId: string;
  nextNumbers: Record<Kind, string>;
}) {
  const t = useTranslations("docgen");
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("invoice");
  const [language, setLanguage] = useState<string>("en");
  const [auto, setAuto] = useState(true);
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await generateOrderDocument({
        orderId,
        kind,
        language,
        numberMode: auto ? "auto" : "manual",
        number: auto ? "" : number,
        date,
        visibleToClient: visible,
      });
      if (r.ok) {
        setVisible(false);
        setNumber("");
        router.refresh();
      } else {
        setError(r.error === "not_found" ? t("notFound") : t("failed"));
      }
    } catch {
      setError(t("failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">{t("title")}</span>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="gen-kind">
              {t("typeLabel")}
            </label>
            <select
              id="gen-kind"
              className={`${inputCls} w-40`}
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(k === "invoice" ? "docInvoice" : "docAct")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="gen-language">
              {t("languageLabel")}
            </label>
            <select
              id="gen-language"
              className={`${inputCls} w-28`}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {t(`lang_${l}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="gen-number">
              {t("numberLabel")}
            </label>
            <input
              id="gen-number"
              className={`${inputCls} w-40`}
              value={auto ? nextNumbers[kind] : number}
              onChange={(e) => setNumber(e.target.value)}
              disabled={auto}
              required={!auto}
              maxLength={50}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="gen-date">
              {t("dateLabel")}
            </label>
            <input
              id="gen-date"
              type="date"
              className={`${inputCls} w-40`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <label className="mb-2 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            {t("autoNumber")}
          </label>
          <label className="mb-2 flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
            />
            {t("visibleToClient")}
          </label>
          <button type="submit" disabled={pending} className="mb-1 btn-primary">
            {pending ? t("generating") : t("generate")}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">{t("hint")}</p>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </CardBody>
    </Card>
  );
}
