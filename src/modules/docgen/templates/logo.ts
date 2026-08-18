/**
 * Issuer wordmark printed at the top of generated invoices/ACTs, supplied as a
 * base64 data URI in ISSUER_LOGO_DATA_URI (no network/file fetch for the PDF
 * renderer, nothing extra for Next standalone output tracing to bundle).
 * Unset — demo/test instances — prints the issuer name as text instead.
 */
export const LOGO_DATA_URI = process.env.ISSUER_LOGO_DATA_URI?.trim() ?? "";
