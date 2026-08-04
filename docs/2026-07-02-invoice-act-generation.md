# Invoice & ACT generation — session notes (2026-07-02)

Implements requirement item 10: software generation of the invoice and the
acceptance certificate (ACT, «акт выполненных работ») for a freight order.
Deferred from Phase 4a (`docs/superpowers/plans/2026-06-15-phase-4a-documents.md`).

## What was built

Order detail → Documents tab → **Generate document** card
(`src/modules/docgen/generate-document-section.tsx`):

- Document type: invoice or ACT; language: EN / RU / AZ (independent of UI locale).
- Numbering: auto (`INV-YYYY-NNN` / `ACT-YYYY-NNN`) with manual override.
- Date defaults to today; optional "visible to client".
- Output: HTML rendered to an A4 PDF server-side, stored in S3 and filed as a
  `documents` row (docType `invoice` / `act`), so it shows in the Documents tab,
  the client portal (when visible), and the audit log.
- The order's `invoiceNumber`/`invoiceDate` (or new `actNumber`/`actDate`) are
  updated in the same transaction; audit action `document_generated`.

## Architecture decisions

- **PDF engine:** `puppeteer-core` driving the distro Chromium
  (`apk add chromium` in the runner image; `PUPPETEER_EXECUTABLE_PATH` env).
  `src/lib/pdf.ts` launches a browser per generation call. Playwright and full
  puppeteer are glibc-bound and don't work on Alpine.
- **Numbering:** `doc_counters` table keyed `(kind, year)` with the same atomic
  upsert row-lock pattern as `orderCounters` (`src/lib/doc-number.ts`). The UI
  preview *peeks* without consuming; the number is allocated at generate time in
  its own transaction. Manual numbers never touch the sequence. A failure after
  allocation leaves a gap — accepted for v1.
- **Templates:** pure TS string functions (`src/modules/docgen/templates/`) —
  shared A4 shell (`layout.ts`, DejaVu Sans for Cyrillic + Azerbaijani ə),
  per-language string dictionaries (`strings.ts`), partials for parties/lines/
  signatures. No React SSR, no next-intl dependency.
- **docType:** new `act` enum value (a `certificate` is a cargo certificate —
  different thing).
- Money strictly in integer cents via `src/lib/money.ts`; single currency (USD)
  per BRD.

## Provisional pieces (replace when the client sends real templates)

- ~~`src/modules/docgen/issuer.ts` — placeholder company requisites~~ **Done
  (2026-07-06):** real RedLine Supply MMC requisites transcribed from the
  client's `RDL-AZL HF.xlsx` (VÖEN, Kapital Bank account/code/corr-account,
  director). See the 2026-07-06 update below.
- ~~`src/modules/docgen/templates/{invoice,act}.ts` + `strings.ts` —
  provisional wording~~ **Reworked to match the client templates (2026-07-06).**
- Signature/stamp scan (`image2.png` in the HF template) is intentionally *not*
  embedded — the signature/stamp areas are left blank for wet-ink signing.

## 2026-07-06 update — real templates, currency, numbering, amount-in-words

The client supplied their branded templates (`tmp/RDL-AZL HF.xlsx` invoice,
`tmp/AKT RDL-AZL.xlsx` ACT). Wired them in:

- **Issuer requisites** (`issuer.ts`): real «Redline Supply» MMC values, plus
  new fields `bankCode` / `bankTaxId` / `correspondentAccount` (rendered in the
  bank-details block with labels Kod / Bank VÖEN / M/h).
- **Logo** (`templates/logo.ts`): RedLine wordmark embedded as a base64
  `data:` URI (extracted from the HF template) and shown in a header band with a
  red rule. No binary committed; Chromium loads it without a file/network fetch.
- **Per-document currency** (AZN / USD), chosen in the generate form. New
  `currency` on `generateDocInputSchema`, `DocData`, and a `documents.currency`
  column (migration `0004_tiresome_grey_gargoyle.sql`, nullable — null for
  uploads and pre-existing docs). Amounts are taken *as-is* in the chosen
  currency (no FX); numeric grouping stays consistent, the currency code and the
  amount-in-words carry the meaning. Default AZN.
- **Amount-in-words** (`src/lib/amount-in-words.ts`): trilingual integer→words
  (AZ authoritative, RU with plural/gender agreement, EN), currency nouns for
  AZN/USD. Renders e.g. `Yeddi yüz on dörd manat 00 qəpik`. Fully unit-tested.
- **Numbering** now matches the client: invoice `RL-DDMMYY###` (date-embedded),
  ACT `AKT № NN`. `formatDocNumber` moved to a client-safe pure module
  (`src/lib/doc-number-format.ts`) so the generate form re-derives the preview
  as the user edits the date; `peekNextDocNumber` → `peekNextDocSeq` (returns
  the raw sequence, formatted client-side). The per-(kind, year) counter and
  atomic allocation are unchanged. **Assumption:** invoice sequence is per-year
  (date disambiguates); ACT `AKT № NN` labels repeat across years — revisit if
  the client needs year-unique ACT numbers.
- **Azerbaijani casing:** `docShell` now sets `<html lang>` so CSS
  `text-transform: uppercase` yields dotted `İ` (e.g. `SİFARİŞÇİ`), and
  `amountInWords` capitalises with `toLocaleUpperCase(lang)`.

Verified: typecheck + 131 unit tests + changed-file lint green; real PDFs
rendered through Chromium in AZ/RU/EN for both invoice and ACT, AZN and USD —
logo, glyphs, requisites, currency, numbering and amount-in-words all correct.

## Environment / ops notes

- Dockerfile runner stage and the `app-dev` compose command install
  `chromium` + `ttf-dejavu` + `font-noto`, with a fallback to the kernel.org
  Alpine mirror — `dl-cdn.alpinelinux.org` proved unreachable from the dev
  machine's network. `ttf-dejavu` alone renders the manat sign ₼ (U+20BC, on
  every AZN amount via `formatMoneyAzn`) as a tofu box; `font-noto` covers it.
- Host `npm run dev` needs `PUPPETEER_EXECUTABLE_PATH` pointing at a local
  Chrome (documented in `.env.example`).
- Dev-machine gotcha: Docker builds hanging at "0/0 steps" or failing with
  extract I/O errors were caused by 30GB of accumulated buildkit cache —
  `docker builder prune --keep-storage 8GB` fixed it.

## Verification performed

- 117 unit tests + lint + typecheck green (template rendering in all three
  languages, escaping, numbering format, input schema).
- Browser-driven E2E on the dev DB: generated RU invoice, AZ/EN ACTs, and a
  manual-numbered invoice through the real UI; verified PDFs download and open
  correctly, counters increment atomically, previews don't burn numbers, manual
  numbers don't consume the sequence, billing fields + audit rows written,
  `visibleToClient` persists.
- Prod Docker image: built, booted, and generated a PDF inside the container
  (Alpine Chromium + standalone output tracing confirmed working).

## Known follow-ups

- Emailing generated documents (mailer is plain-text only; needs attachment
  support in `src/lib/mailer.ts`).
- ~~Real client templates + real issuer requisites~~ — done 2026-07-06.
- A settings UI for editable requisites is still out of scope (hard-coded in
  `issuer.ts`). Currency is now per-document (AZN/USD); further currencies just
  need adding to `DOC_CURRENCIES` + noun tables in `amount-in-words.ts`.
- ACT `AKT № NN` numbers repeat across years (see assumption above).
- `tmp/rename.jpeg` is an unrelated mockup of a **payments/reconciliation**
  table (carriers payable / clients receivable / paid / delta) — a separate
  future feature, not part of docgen.
