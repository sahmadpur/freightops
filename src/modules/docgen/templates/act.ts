import { docShell, esc, formatDocDate } from "./layout";
import { clientCell, issuerCell, linesTable, orderMetaBlock, signaturesBlock } from "./partials";
import { ACT_STRINGS } from "./strings";
import type { ActData, DocLanguage } from "./types";

/**
 * Provisional acceptance-certificate (ACT) layout — replace this markup with
 * the client's real template when it arrives; the data payload and pipeline
 * stay the same.
 */
export function renderActHtml(data: ActData, lang: DocLanguage): string {
  const t = ACT_STRINGS[lang];
  const body = `
  <h1>${esc(t.docTitle)}</h1>
  <p class="doc-subtitle">${esc(t.numberDate(data.number, formatDocDate(data.date, lang)))}</p>
  <table class="parties"><tr>
    ${issuerCell(t.executor, data.issuer, t)}
    ${clientCell(t.customer, data.client, t)}
  </tr></table>
  <p class="terms">${esc(t.body(data.order.number))}</p>
  ${orderMetaBlock(data.order, t)}
  ${linesTable(data.lines, data.totalCents, t)}
  <p class="terms">${esc(t.noClaims)}</p>
  ${signaturesBlock(t.executor, t.customer, data, t)}`;
  return docShell(`${t.docTitle} ${data.number}`, body);
}
