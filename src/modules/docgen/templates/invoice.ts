import { docShell, esc, formatDocDate } from "./layout";
import {
  bankDetailsBlock,
  clientCell,
  issuerCell,
  linesTable,
  orderMetaBlock,
  signaturesBlock,
} from "./partials";
import { INVOICE_STRINGS } from "./strings";
import type { DocLanguage, InvoiceData } from "./types";

/**
 * Provisional invoice layout — replace this markup with the client's real
 * template when it arrives; the data payload and pipeline stay the same.
 */
export function renderInvoiceHtml(data: InvoiceData, lang: DocLanguage): string {
  const t = INVOICE_STRINGS[lang];
  const body = `
  <h1>${esc(t.docTitle)}</h1>
  <p class="doc-subtitle">${esc(t.numberDate(data.number, formatDocDate(data.date, lang)))}</p>
  <table class="parties"><tr>
    ${issuerCell(t.seller, data.issuer, t)}
    ${clientCell(t.buyer, data.client, t)}
  </tr></table>
  ${bankDetailsBlock(data.issuer, t)}
  ${orderMetaBlock(data.order, t)}
  ${linesTable(data.lines, data.totalCents, t)}
  <p class="terms">${esc(t.paymentTerms)}</p>
  ${signaturesBlock(t.seller, t.buyer, data, t)}`;
  return docShell(`${t.docTitle} ${data.number}`, body);
}
