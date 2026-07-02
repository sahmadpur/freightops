import { esc } from "./layout";
import type { CommonStrings } from "./strings";
import type { DocData, DocLine, DocOrderInfo, DocParty } from "./types";
import type { Issuer } from "../issuer";

/** Cents → "4,200.00" (no symbol; the column header names the currency). */
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

export function issuerCell(role: string, issuer: Issuer, t: CommonStrings): string {
  return `<td>
    <div class="party-role">${esc(role)}</div>
    <div class="party-name">${esc(issuer.name)}</div>
    <div class="kv">
      ${kv(t.taxId, issuer.taxId)}
      ${kv(t.address, issuer.address)}
      ${kv(t.phone, issuer.phone)}
      ${kv(t.email, issuer.email)}
    </div>
  </td>`;
}

export function clientCell(role: string, client: DocParty, t: CommonStrings): string {
  return `<td>
    <div class="party-role">${esc(role)}</div>
    <div class="party-name">${esc(client.title)}</div>
    <div class="kv">
      ${kv(t.taxId, client.taxId)}
      ${kv(t.address, client.address)}
    </div>
  </td>`;
}

export function bankDetailsBlock(issuer: Issuer, t: CommonStrings): string {
  return `<div class="meta">
    <div class="party-role">${esc(t.bankDetails)}</div>
    ${kv(t.bank, issuer.bankName)}
    ${kv(t.account, issuer.bankAccount)}
    ${kv(t.swift, issuer.swift)}
  </div>`;
}

export function orderMetaBlock(order: DocOrderInfo, t: CommonStrings): string {
  return `<div class="meta">
    ${kv(t.orderRef, order.number)}
    ${kv(t.clientRef, order.clientOrderId)}
    ${kv(t.route, order.route)}
    ${kv(t.cargo, order.cargoDescription)}
    ${kv(t.packages, order.packages != null ? String(order.packages) : null)}
    ${kv(t.weightKg, order.weightKg)}
    ${kv(t.volumeM3, order.volumeM3)}
    ${kv(t.incoterms, order.incoterms)}
  </div>`;
}

export function linesTable(lines: DocLine[], totalCents: number, t: CommonStrings): string {
  const rows = lines
    .map(
      (line, i) => `<tr>
      <td class="no">${i + 1}</td>
      <td>${esc(line.description)}</td>
      <td class="num">${formatDocMoney(line.amountCents)}</td>
    </tr>`,
    )
    .join("\n");
  return `<table class="lines">
    <thead>
      <tr>
        <th class="no">${esc(t.colNo)}</th>
        <th>${esc(t.colDescription)}</th>
        <th class="num">${esc(t.colAmount)}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="totals"><span class="grand">${esc(t.total)}: ${formatDocMoney(totalCents)} ${esc(t.currency)}</span></div>
  <div class="vat-note">${esc(t.vatNote)}</div>`;
}

export function signaturesBlock(
  leftRole: string,
  rightRole: string,
  data: DocData,
  t: CommonStrings,
): string {
  const left = `<td>
    <div class="sig-role">${esc(leftRole)}</div>
    <div class="sig-line"></div>
    <div class="sig-caption">${esc(data.issuer.signatoryTitle)} ${esc(data.issuer.signatoryName)} · ${esc(t.signature)} / ${esc(t.stamp)}</div>
  </td>`;
  const right = `<td>
    <div class="sig-role">${esc(rightRole)}</div>
    <div class="sig-line"></div>
    <div class="sig-caption">${esc(data.client.title)} · ${esc(t.signature)} / ${esc(t.stamp)}</div>
  </td>`;
  return `<table class="signatures"><tr>${left}${right}</tr></table>`;
}
