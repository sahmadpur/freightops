import { ISSUER } from "../issuer";
import { LOGO_DATA_URI } from "./logo";
import type { DocLanguage } from "./types";

/** Escape a value for interpolation into HTML text/attribute content. */
export function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Format an ISO date (YYYY-MM-DD) for display on a document. */
export function formatDocDate(iso: string, lang: DocLanguage): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  if (lang === "en") {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
  }
  return `${d}.${m}.${y}`;
}

/**
 * Shared A4 shell for generated documents: the company letterhead (mark and
 * wordmark top right, watermark behind the text, red address band at the foot)
 * rebuilt in CSS rather than pasted in as the Word template's full-page bitmap,
 * so it stays sharp and reflows to A4.
 *
 * DejaVu covers Latin, Cyrillic and Azerbaijani ə (installed in the runtime
 * image via ttf-dejavu — see Dockerfile).
 */
export function docShell(title: string, bodyHtml: string, lang: DocLanguage): string {
  // The lang attribute makes CSS text-transform locale-aware, so Azerbaijani
  // headings uppercase "i" → "İ" (dotted) rather than the Latin "I".
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: "DejaVu Serif", "Times New Roman", Times, serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #111;
    margin: 0;
    /* At least one full page, so the address band lands at the foot of the
       page on a one-page document; the padding reserves its room. */
    position: relative;
    min-height: 100vh;
    padding: 10mm 16mm 22mm;
  }
  h1 {
    font-size: 15pt;
    text-align: center;
    margin: 0 0 2mm;
    letter-spacing: 0.02em;
  }
  /* ---- letterhead ---- */
  .doc-head { display: flex; align-items: flex-start; justify-content: flex-end; margin-bottom: 4mm; }
  .doc-brand { text-align: center; }
  .doc-brand img { height: 13mm; display: block; margin: 0 auto; }
  .doc-brand span { display: block; font-size: 10pt; line-height: 1.15; margin-top: 0.8mm; }
  .doc-watermark {
    position: fixed;
    top: 50%; left: 50%;
    width: 90mm;
    transform: translate(-50%, -50%);
    opacity: 0.06;
    z-index: -1;
  }
  .doc-foot {
    /* Absolute, not fixed: a fixed band would repeat on every page and print
       over the text, since page padding only applies once. */
    position: absolute;
    left: 0; right: 0; bottom: 0;
    background: #c80024;
    color: #fff;
    text-align: center;
    font-size: 10pt;
    padding: 3.5mm 10mm;
  }
  /* ---- body ---- */
  .doc-subtitle { text-align: center; font-size: 11pt; margin: 0 0 6mm; }
  .doc-lead { text-align: center; margin: 0 0 3mm; }
  .row { display: flex; justify-content: space-between; gap: 8mm; }
  .rule { border: 0; border-top: 0.3mm solid #333; margin: 2.5mm 0; }
  .amount-words { margin-bottom: 5mm; }
  .block { margin-bottom: 4mm; }
  /* Requisites read as two columns so a full invoice still fits one page. */
  .cols { column-count: 2; column-gap: 8mm; }
  .block-title { font-weight: bold; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.06em; margin-bottom: 1mm; }
  .party-name { font-weight: bold; }
  .kv div { margin-bottom: 0.5mm; }
  .kv .k { color: #444; }
  .terms { margin-bottom: 6mm; }
  table.lines { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  table.lines th, table.lines td { border: 0.3mm solid #333; padding: 1.6mm 2.4mm; vertical-align: top; }
  /* A long line list spills to a second page with its header intact. */
  table.lines thead { display: table-header-group; }
  table.lines tr { page-break-inside: avoid; }
  table.lines thead th { background: #c80024; color: #fff; text-align: center; font-size: 9.5pt; }
  table.lines td.num, table.lines th.num { text-align: right; white-space: nowrap; }
  table.lines td.no, table.lines th.no { width: 10mm; text-align: center; }
  table.lines td.qty, table.lines th.qty { width: 22mm; text-align: center; }
  table.lines td.amount, table.lines th.amount { width: 34mm; }
  table.lines tr.sum td { font-weight: bold; }
  table.lines tr.grand td { font-weight: bold; background: #f4f4f4; }
  .signatures { width: 100%; border-collapse: collapse; margin-top: 8mm; page-break-inside: avoid; }
  .signatures td { vertical-align: top; width: 50%; padding-right: 8mm; }
  .sig-role { margin-bottom: 8mm; }
  .sig-line { border-bottom: 0.3mm solid #333; height: 6mm; margin-bottom: 1mm; }
  .sig-caption { font-size: 8.5pt; color: #555; }
</style>
</head>
<body>
<img class="doc-watermark" src="${LOGO_DATA_URI}" alt="">
<div class="doc-head">
  <div class="doc-brand">
    <img src="${LOGO_DATA_URI}" alt="ALL IN">
    <span>All In<br>Logistics</span>
  </div>
</div>
${bodyHtml}
<div class="doc-foot">${esc(ISSUER.address)}</div>
</body>
</html>`;
}
