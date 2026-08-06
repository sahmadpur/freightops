import { docShell, esc, formatDocDate } from "./layout";
import {
  bankDetailsBlock,
  clientBlock,
  issuerLine,
  linesTable,
  orderMetaBlock,
  signaturesBlock,
} from "./partials";
import { INVOICE_STRINGS } from "./strings";
import type { DocLanguage, InvoiceData } from "./types";

/** Invoice (hesab-faktura) — follows the company's Invoice_*.docx templates. */
export function renderInvoiceHtml(data: InvoiceData, lang: DocLanguage): string {
  const t = INVOICE_STRINGS[lang];
  const body = `
  <h1>${esc(t.docTitle)}</h1>
  <p class="doc-subtitle">${esc(t.numberLine(data.number))}</p>
  ${issuerLine(t.issuedBy, data.issuer, formatDocDate(data.date, lang), t)}
  <hr class="rule">
  ${bankDetailsBlock(data.issuer, data.bank, t)}
  <hr class="rule">
  ${clientBlock(t.buyer, data.client, t)}
  ${orderMetaBlock(data.order, t)}
  ${linesTable(data.lines, data.totalCents, data.currency, lang, t)}
  <p class="terms">${esc(t.paymentTerms)}</p>
  ${signaturesBlock(t.director, t.buyer, data.issuer, data.client, t)}`;
  return docShell(`${t.docTitle} ${data.number}`, body, lang);
}
