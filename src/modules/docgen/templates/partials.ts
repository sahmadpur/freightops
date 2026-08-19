import { amountInWords, type DocCurrency } from "@/lib/amount-in-words";
import { esc } from "./layout";
import type { CommonStrings } from "./strings";
import type { DocLanguage, DocLine, DocOrderInfo, DocParty } from "./types";
import type { Issuer, IssuerBank } from "../issuer";

/**
 * VAT rate printed on every invoice and ACT, as on the company's Word
 * templates. Line amounts are net; VAT is added on top.
 * ponytail: one company-wide rate — make it a per-document field if a
 * 0%-rated (export) invoice is ever needed.
 */
export const VAT_RATE = 18;

/** Net total → the VAT and gross figures the summary rows print. */
export function docTotals(totalCents: number): { vatCents: number; grandTotalCents: number } {
  const vatCents = Math.round((totalCents * VAT_RATE) / 100);
  return { vatCents, grandTotalCents: totalCents + vatCents };
}

/**
 * Minor units → "4,200.00" (no symbol; the column header and total name the
 * currency). Grouping is kept consistent across currencies — the explicit
 * currency code and the amount-in-words line carry the legal meaning.
 */
export function formatDocMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function kv(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<div><span class="k">${esc(label)}:</span> ${esc(value)}</div>`;
}

/** "Issued by: «ALL IN LOG» MMC" on the left, the document date on the right. */
export function issuerLine(role: string, issuer: Issuer, date: string, t: CommonStrings): string {
  return `<div class="block">
    <div class="row">
      <div><span class="k">${esc(role)}:</span> <span class="party-name">${esc(issuer.name)}</span></div>
      <div><span class="k">${esc(t.date)}:</span> ${esc(date)}</div>
    </div>
    <div class="kv">${kv(t.taxId, issuer.taxId)}</div>
  </div>`;
}

export function clientBlock(role: string, client: DocParty, t: CommonStrings): string {
  return `<div class="block">
    <div><span class="k">${esc(role)}:</span> <span class="party-name">${esc(client.title)}</span></div>
    <div class="kv">
      ${kv(t.taxId, client.taxId)}
      ${kv(t.address, client.address)}
    </div>
  </div>`;
}

/** Account block for the document's currency, with its own correspondent. */
export function bankDetailsBlock(issuer: Issuer, bank: IssuerBank, t: CommonStrings): string {
  return `<div class="block kv cols">
    ${kv(t.account, bank.account)}
    ${kv(t.taxId, issuer.taxId)}
    ${kv(t.bank, issuer.bankName)}
    ${kv(t.swift, issuer.swift)}
    ${kv(t.bankTaxId, issuer.bankTaxId)}
    ${kv(t.bankCode, issuer.bankCode)}
    ${kv(t.correspondentBank, bank.correspondentBank)}
    ${kv(t.correspondentSwift, bank.correspondentSwift)}
    ${kv(t.correspondentAccount, bank.correspondentAccount)}
  </div>`;
}

export function orderMetaBlock(order: DocOrderInfo, t: CommonStrings): string {
  return `<div class="block kv cols">
    ${kv(t.orderRef, order.number)}
    ${kv(t.route, order.route)}
    ${kv(t.cargo, order.cargoDescription)}
    ${kv(t.packages, order.packages != null ? String(order.packages) : null)}
    ${kv(t.weightKg, order.weightKg)}
    ${kv(t.volumeM3, order.volumeM3)}
    ${kv(t.incoterms, order.incoterms)}
  </div>`;
}

/**
 * The four-column work table with the Total / VAT / Grand total rows the Word
 * templates end on, followed by the grand total in words.
 */
export function linesTable(
  lines: DocLine[],
  totalCents: number,
  currency: DocCurrency,
  lang: DocLanguage,
  t: CommonStrings,
): string {
  const { vatCents, grandTotalCents } = docTotals(totalCents);
  const rows = lines
    .map(
      (line, i) => `<tr>
      <td class="no">${i + 1}</td>
      <td>${esc(line.description)}</td>
      <td class="qty">${line.quantity != null ? esc(line.quantity) : ""}</td>
      <td class="num amount">${formatDocMoney(line.amountCents)}</td>
    </tr>`,
    )
    .join("\n");
  const summary = (label: string, cents: number, cls: string) => `<tr class="${cls}">
      <td colspan="3">${esc(label)}</td>
      <td class="num amount">${formatDocMoney(cents)}</td>
    </tr>`;
  return `<table class="lines">
    <thead>
      <tr>
        <th class="no">${esc(t.colNo)}</th>
        <th>${esc(t.colDescription)}</th>
        <th class="qty">${esc(t.colQuantity)}</th>
        <th class="amount">${esc(`${t.colAmount} (${currency})`)}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${summary(t.total, totalCents, "sum")}
      ${summary(t.vat(VAT_RATE), vatCents, "sum")}
      ${summary(t.grandTotal, grandTotalCents, "grand")}
    </tbody>
  </table>
  <div class="amount-words">${esc(`${t.amountInWordsLabel}: ${amountInWords(grandTotalCents, currency, lang)}`)}</div>`;
}

/** Two signature columns: the issuer's director on the left, the client's on the right. */
export function signaturesBlock(
  leftRole: string,
  rightRole: string,
  issuer: Issuer,
  client: DocParty,
  t: CommonStrings,
): string {
  const left = `<td>
    <div class="sig-role">${esc(leftRole)}: ${esc(issuer.signatoryName)}</div>
    <div class="sig-line"></div>
    <div class="sig-caption">${esc(t.signature)} / ${esc(t.stamp)}</div>
  </td>`;
  const right = `<td>
    <div class="sig-role">${esc(rightRole)}: ${esc(client.title)}</div>
    <div class="sig-line"></div>
    <div class="sig-caption">${esc(t.signature)} / ${esc(t.stamp)}</div>
  </td>`;
  return `<table class="signatures"><tr>${left}${right}</tr></table>`;
}
