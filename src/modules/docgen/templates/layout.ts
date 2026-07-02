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
 * Shared A4 shell for generated documents. DejaVu Sans covers Latin, Cyrillic
 * and Azerbaijani ə (installed in the runtime image via ttf-dejavu).
 */
export function docShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "DejaVu Sans", "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #111;
    margin: 0;
  }
  h1 {
    font-size: 15pt;
    text-align: center;
    margin: 0 0 2mm;
    letter-spacing: 0.02em;
  }
  .doc-subtitle { text-align: center; font-size: 11pt; margin: 0 0 8mm; }
  .parties { width: 100%; border-collapse: collapse; margin-bottom: 6mm; }
  .parties td { vertical-align: top; width: 50%; padding: 0 4mm 0 0; }
  .party-role { font-weight: bold; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.06em; margin-bottom: 1mm; }
  .party-name { font-weight: bold; margin-bottom: 1mm; }
  .kv { margin: 0; }
  .kv div { margin-bottom: 0.5mm; }
  .kv .k { color: #444; }
  .meta { margin-bottom: 6mm; }
  .meta div { margin-bottom: 0.5mm; }
  table.lines { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  table.lines th, table.lines td { border: 0.3mm solid #333; padding: 1.6mm 2.4mm; }
  table.lines th { background: #f0f0f0; text-align: left; font-size: 9.5pt; }
  table.lines td.num, table.lines th.num { text-align: right; white-space: nowrap; }
  table.lines td.no, table.lines th.no { width: 8mm; text-align: center; }
  .totals { text-align: right; margin-bottom: 2mm; }
  .totals .grand { font-weight: bold; font-size: 11.5pt; }
  .vat-note { text-align: right; color: #444; margin-bottom: 8mm; }
  .terms { margin-bottom: 10mm; }
  .signatures { width: 100%; border-collapse: collapse; margin-top: 12mm; page-break-inside: avoid; }
  .signatures td { vertical-align: top; width: 50%; padding-right: 8mm; }
  .sig-role { font-weight: bold; margin-bottom: 10mm; }
  .sig-line { border-bottom: 0.3mm solid #333; height: 8mm; margin-bottom: 1mm; }
  .sig-caption { font-size: 8.5pt; color: #555; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
