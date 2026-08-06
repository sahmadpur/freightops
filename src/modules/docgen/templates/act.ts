import { amountInWords } from "@/lib/amount-in-words";
import { docShell, esc, formatDocDate } from "./layout";
import { docTotals, formatDocMoney, linesTable, orderMetaBlock, signaturesBlock } from "./partials";
import { ACT_STRINGS } from "./strings";
import type { ActData, DocLanguage } from "./types";

/**
 * Acceptance certificate (ACT) — follows the company's Act_*.docx templates.
 * Unlike the invoice it carries no bank details; the amount it confirms is the
 * gross figure, so it agrees with the invoice's grand total.
 */
export function renderActHtml(data: ActData, lang: DocLanguage): string {
  const t = ACT_STRINGS[lang];
  const { grandTotalCents } = docTotals(data.totalCents);
  const date = formatDocDate(data.date, lang);
  const body = `
  <p class="doc-lead">${esc(t.heading(data.issuer.name, data.client.title))}</p>
  <h1>${esc(t.docTitle)}</h1>
  <p class="doc-subtitle">${esc(t.numberLine(data.number))}</p>
  <div class="block row"><div>${esc(t.city)}</div><div><span class="k">${esc(t.date)}:</span> ${esc(date)}</div></div>
  <p class="terms">${esc(
    t.body({
      issuer: data.issuer.name,
      signatory: data.issuer.signatoryName,
      client: data.client.title,
      orderNumber: data.order.number,
      amount: `${formatDocMoney(grandTotalCents)} ${data.currency}`,
      amountInWords: amountInWords(grandTotalCents, data.currency, lang),
    }),
  )}</p>
  ${orderMetaBlock(data.order, t)}
  ${linesTable(data.lines, data.totalCents, data.currency, lang, t)}
  <p class="terms">${esc(t.noClaims)}</p>
  ${signaturesBlock(t.handedOverBy, t.acceptedBy, data.issuer, data.client, t)}`;
  return docShell(`${t.docTitle} ${data.number}`, body, lang);
}
