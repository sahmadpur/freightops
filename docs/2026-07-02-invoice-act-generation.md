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

- `src/modules/docgen/issuer.ts` — **placeholder company requisites** (name,
  VÖEN, bank details, signatory). Swap in real values.
- `src/modules/docgen/templates/{invoice,act}.ts` + `strings.ts` — provisional
  layout/wording. Only these files should change when the real templates arrive;
  the data payload, numbering, and pipeline stay as-is.

## Environment / ops notes

- Dockerfile runner stage and the `app-dev` compose command install
  `chromium` + `ttf-dejavu`, with a fallback to the kernel.org Alpine mirror —
  `dl-cdn.alpinelinux.org` proved unreachable from the dev machine's network.
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
- Real client templates + real issuer requisites (see above).
- Multi-currency and a settings UI for requisites are out of scope for v1.
