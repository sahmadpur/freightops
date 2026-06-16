# DocAI — Design System Spec (Portable)

> **Purpose of this file.** Hand this to a frontend-design skill in another codebase. It captures the complete visual language of **DocAI** (a multilingual document-archive platform) so the target platform can be re-skinned to look *identical in design DNA* — same palette, typography, spacing, component shapes, motion, and the distinctive "archival / ledger / catalog-card" editorial aesthetic. Adapt the *content* to the target app, but keep the *design language* exact.

The reference stack is **Next.js 14 (App Router) + Tailwind CSS + next-intl + lucide-react + Radix primitives**. If the target uses a different stack, translate the tokens and recipes faithfully (the CSS variables and class recipes below are framework-agnostic).

---

## 1. Design DNA (the vibe — read this first)

DocAI is **"a digital reading room for a physical archive."** The aesthetic is editorial and tactile, not generic SaaS:

- **Warm paper + deep forest green.** Cream "paper" surfaces and a dark, serious forest-green brand. It should feel like a well-kept ledger or library catalog, not a neon dashboard.
- **Three typographic voices.** A **serif display** (Fraunces) for headings/hero, a **humanist sans** (Calibri stack) for all UI/body, and a **monospace** (JetBrains Mono) for metadata, labels, IDs, and "stamped" eyebrow text. The mono-uppercase-with-wide-tracking treatment is a signature.
- **Archival ornament.** Tick-mark corners, perforation dot-rows, dashed metadata rules, "APPROVED" rubber stamps, ruled ledger margins, document ID treatments (`DOC-000142`). Used sparingly on hero/auth/empty states — never clutter the working UI.
- **Quiet, dense working surfaces.** Data tables, filter bars, and forms are compact (11–13px), low-chroma, with green accents only on active/hover/primary states. The drama lives in the chrome (sidebar, auth, hero); the workspace is calm.
- **Restrained motion.** Gentle rise-fade entrances, slow floating catalog cards, a pulsing stamp. Nothing bouncy or fast.
- **Full dark mode** built as a token flip (cool slate surfaces + muted sage green), not an afterthought.

When in doubt: **understated, warm, editorial, precise.**

---

## 2. Color tokens

Colors are defined as **space-separated RGB channel triplets** in CSS variables, consumed via `rgb(var(--token) / <alpha>)`. This lets every token support opacity. Reproduce this pattern exactly.

### 2.1 Light theme (`:root`, `[data-theme="light"]`)

```css
:root, [data-theme="light"] {
  /* Brand — accents, nav, primary buttons */
  --brand: 45 80 22;          /* #2d5016 dark forest green (PRIMARY) */
  --brand-hover: 58 107 30;   /* #3a6b1e */
  --brand-deep: 28 51 13;     /* #1c330d darkest — headings on light */
  --brand-accent: 125 181 66; /* #7db542 bright lime accent */
  --brand-light: 197 228 154; /* #c5e49a */
  --brand-pale: 232 245 208;  /* #e8f5d0 — text/icon ON a green button */
  --brand-chip: 74 140 28;    /* #4a8c1c */

  /* Paper — cream chrome for auth / editorial surfaces */
  --paper: 246 240 223;       /* #f6f0df */
  --paper-dim: 235 227 202;   /* #ebe3ca */
  --paper-edge: 217 207 176;  /* #d9cfb0 */

  /* Ink — body text on paper */
  --ink: 27 32 27;            /* #1b201b near-black green-grey */
  --ink-soft: 74 84 74;       /* #4a544a secondary text */

  /* Surface scale — the app workspace (cooler/lighter than paper) */
  --surface: 244 246 243;       /* #f4f6f3 page background */
  --surface-card: 255 255 255;  /* cards, tables, inputs */
  --surface-hover: 247 251 240; /* #f7fbf0 row hover */
  --surface-thead: 240 247 232; /* #f0f7e8 table header */
  --surface-chip-active: 234 243 222; /* #eaf3de active filter chip */

  /* Edges / borders (Tailwind reserves `border` as a util prefix → use `edge`) */
  --edge-soft: 221 232 208;   /* #dde8d0 subtle dividers */
  --edge-chip: 200 221 176;   /* #c8ddb0 visible input/btn borders */
  --edge-focus: 74 140 28;    /* #4a8c1c focus ring */

  /* Status dots */
  --dot-done: 99 153 34;      /* green */
  --dot-progress: 239 159 39; /* amber */
  --dot-pending: 170 170 170; /* grey */
  --dot-failed: 201 73 73;    /* red */

  /* Page default text */
  --text-default: 26 26 26;
}
```

### 2.2 Semantic chip/badge tokens (light)

Soft tinted background + saturated foreground per category. Used for document-type badges and approval/status pills.

```css
/* Doc-type badges (bg / fg pairs) */
--badge-contract-bg: 230 241 251; --badge-contract-fg: 24 95 165;  /* blue */
--badge-invoice-bg: 250 238 218;  --badge-invoice-fg: 133 79 11;   /* amber */
--badge-report-bg: 234 243 222;   --badge-report-fg: 59 109 17;    /* green */
--badge-letter-bg: 251 234 240;   --badge-letter-fg: 153 53 86;    /* rose */
--badge-permit-bg: 238 237 254;   --badge-permit-fg: 83 74 183;    /* indigo */
--badge-other-bg: 241 241 241;    --badge-other-fg: 85 85 85;      /* grey */

/* Approval / workflow states (bg / fg / edge triples) */
--approval-pending-bg: 255 251 235;  --approval-pending-fg: 180 83 9;   --approval-pending-edge: 253 230 138;
--approval-approved-bg: 236 253 245; --approval-approved-fg: 4 120 87;  --approval-approved-edge: 167 243 208;
--approval-rejected-bg: 255 241 242; --approval-rejected-fg: 159 18 57; --approval-rejected-edge: 254 205 211;
--approval-revision-bg: 240 249 255; --approval-revision-fg: 3 105 161; --approval-revision-edge: 186 230 253;

/* Destructive button chrome */
--danger-bg: 253 241 241; --danger-fg: 201 73 73; --danger-edge: 224 180 180;

/* @mention row highlight */
--mention-row-bg: 251 251 239;
```

### 2.3 Sidebar tokens (decoupled from brand on purpose)

The sidebar has its own tokens so its dark-green look is stable across theme inversion.

```css
--sidebar-bg: 45 80 22;        /* #2d5016 dark forest green */
--sidebar-fg: 232 245 208;     /* cream — active/high-emphasis nav text */
--sidebar-fg-soft: 197 228 154;/* sage-cream — inactive nav text */
--sidebar-chip: 74 140 28;     /* avatar bg */
```

### 2.4 Dark theme (`[data-theme="dark"]`)

Cool neutral slate surfaces + a **muted sage** primary (a restrained echo of the light green). **Key inversion rule:** in light mode `--brand` is dark and `--brand-pale` is light; in dark mode they flip — `--brand` becomes light (so links read on dark surfaces) and `--brand-pale` becomes dark (so text on a green button stays readable).

```css
[data-theme="dark"] {
  --brand: 145 188 160;        /* #91bca0 calm sage, AA on dark */
  --brand-hover: 165 205 180;
  --brand-deep: 220 232 224;   /* near-white sage for headers */
  --brand-accent: 145 188 160;
  --brand-light: 204 224 210;
  --brand-pale: 18 28 22;      /* DARK forest — text ON bg-brand */
  --brand-chip: 78 112 92;

  --paper: 17 22 28;           /* deeper than page, for chrome */
  --paper-dim: 13 17 22;
  --paper-edge: 38 46 56;

  --ink: 232 234 230;          /* crisp cream-white text */
  --ink-soft: 152 160 170;     /* cool grey secondary */

  --surface: 14 18 24;             /* #0e1218 page bg */
  --surface-card: 22 28 36;        /* #161c24 cards/tables/inputs */
  --surface-hover: 32 40 50;       /* row hover / elevated */
  --surface-thead: 18 23 30;       /* table head */
  --surface-chip-active: 38 56 46; /* subtle sage tint */

  --edge-soft: 36 43 53;
  --edge-chip: 68 78 92;
  --edge-focus: 145 188 160;

  --dot-done: 145 200 158; --dot-progress: 230 178 110;
  --dot-pending: 132 140 154; --dot-failed: 232 134 130;

  /* Approval — M3 container / on-container pairings */
  --approval-pending-bg: 60 46 18;  --approval-pending-fg: 244 212 138; --approval-pending-edge: 110 86 36;
  --approval-approved-bg: 24 50 32; --approval-approved-fg: 162 220 178;--approval-approved-edge: 48 90 64;
  --approval-rejected-bg: 70 26 28; --approval-rejected-fg: 252 168 162;--approval-rejected-edge: 130 56 56;
  --approval-revision-bg: 18 44 60; --approval-revision-fg: 140 200 230;--approval-revision-edge: 44 84 110;

  /* Doc-type badges — dark container / soft on-container */
  --badge-contract-bg: 24 42 72; --badge-contract-fg: 158 192 240;
  --badge-invoice-bg: 64 46 18;  --badge-invoice-fg: 240 198 130;
  --badge-report-bg: 32 56 32;   --badge-report-fg: 170 218 162;
  --badge-letter-bg: 70 28 50;   --badge-letter-fg: 244 180 208;
  --badge-permit-bg: 36 36 68;   --badge-permit-fg: 188 184 236;
  --badge-other-bg: 50 56 64;    --badge-other-fg: 196 200 210;

  --danger-bg: 76 26 28; --danger-fg: 244 162 158; --danger-edge: 128 54 54;
  --mention-row-bg: 24 36 28;

  --sidebar-bg: 14 22 18;        /* #0e1612 deep forest-slate */
  --sidebar-fg: 232 234 230;
  --sidebar-fg-soft: 168 190 178;
  --sidebar-chip: 78 112 92;

  --text-default: 232 234 230;
}
```

### 2.5 Tailwind named-gray flip (important for dark mode)

Components freely use Tailwind's `text-gray-500/700/900` and `bg-gray-50/100`. In dark mode these are **remapped via CSS overrides** so the scale inverts (gray-900 becomes the *brightest* text, gray-50 the dimmest) and grays pick up the cool-slate tint. If your target codebase also leans on raw `gray-*`/`red-*`/`green-*` utilities, port these overrides (see §9) — otherwise body text renders near-black on dark.

---

## 3. Typography

Three font families, loaded as below. Reproduce the *roles* even if you substitute fonts.

| Role | Family | CSS var / stack | Used for |
|---|---|---|---|
| **Display (serif)** | **Fraunces** (Google, weights 300–700, normal+italic) | `--font-display`, fallback `Georgia, 'Iowan Old Style', serif` | Hero headings, page H1s, auth headlines, card titles (often *italic*) |
| **UI / body (sans)** | **Calibri** stack | `Calibri, Aptos, "Segoe UI", Arial, sans-serif` (set on `html`, exposed as `font-brand`) | All app text, tables, forms, buttons |
| **Mono** | **JetBrains Mono** (Google, 400/500) | `--font-mono`, fallback `ui-monospace, SFMono-Regular, Menlo, monospace` | Eyebrows, metadata, doc IDs, labels, status text, stamps |

Load (Next.js example):
```ts
import { Fraunces, JetBrains_Mono } from "next/font/google";
const fraunces = Fraunces({ subsets:["latin","latin-ext"], weight:["300","400","500","600","700"], style:["normal","italic"], variable:"--font-display", display:"swap" });
const jetbrainsMono = JetBrains_Mono({ subsets:["latin","latin-ext"], weight:["400","500"], variable:"--font-mono", display:"swap" });
// html gets className `${fraunces.variable} ${jetbrainsMono.variable}` and font-family: Calibri stack
```

### Type scale & signature treatments
- **Hero / auth H1:** `font-display`, 44–64px, `leading-[0.95]`, `tracking-[-0.01em]`. Often a 3-line stack with the middle line in **italic** + `text-brand-light`.
- **Page title (TopBar):** 15px, `font-semibold`, `text-gray-900`.
- **Card / archive title:** `font-display italic`, ~17px, `leading-snug`.
- **Body:** 12.5–14px sans, `text-ink` / `text-gray-700`.
- **Table cells:** 12.5px; **table headers:** 11px `font-semibold` `text-brand-deep`.
- **Eyebrow / metadata / labels (SIGNATURE):** `font-mono`, 9.5–11px, `uppercase`, wide letter-spacing `tracking-[0.18em]`–`tracking-[0.28em]`, color `text-ink-soft` or `text-brand-accent`. Frequently paired with a short `w-4 h-px bg-brand-accent` rule before the text.
- **Doc ID:** `font-mono`, e.g. `DOC-002847`, tracked `tracking-[0.02em]`.

---

## 4. Shape, spacing, elevation

- **Radii:** cards/tables/containers `rounded-[10px]`; buttons/inputs `rounded-[5px]`–`rounded-[6px]`; pills/chips `rounded-[10px]`–`rounded-[20px]` / `rounded-full`. Editorial archive cards are **sharp (no radius)** to read as paper stock.
- **Borders:** 1px, low-contrast, using `edge-*` tokens (never Tailwind `border-gray` directly for chrome). Active states swap border to `edge-chip`/`brand-accent`.
- **Shadows:** the working UI is mostly **flat** (border-defined, not shadow-defined). Reserve shadow for floating/editorial elements: archive cards use `shadow-[0_22px_44px_-18px_rgba(0,0,0,0.45)]` + `ring-1 ring-paper-edge`.
- **Density:** compact. Buttons `px-3.5 py-1.5`; table cells `px-3 py-2.5`; filter bar `px-[22px] py-2`; sidebar items `py-2.5 px-[18px]`.
- **Page rhythm:** top chrome is a thin `h-10` header bar; below it, content scrolls. Section chrome (TopBar, FilterBar) sits on `bg-surface-card` with a `border-b border-edge-soft`.

---

## 5. Core layout

### App shell (authenticated)
```
flex min-h-screen bg-surface
├─ Sidebar (fixed 210px, bg-sidebar, full-height, sticky)
└─ flex-1 column
   ├─ header  h-10 bg-surface-card border-b border-edge-soft, right-aligned (notifications, language switch)
   └─ main    flex-1 overflow-auto  → page renders TopBar + FilterBar + content
```

### Sidebar (signature component)
- `w-[210px]`, `bg-sidebar` (dark forest green), full-height sticky, flex column.
- **Wordmark:** "Doc" 16px `font-semibold text-sidebar-fg` + superscript "AI" in `text-[10px] text-brand-accent`. (Adapt the wordmark to the target app but keep the split-color superscript treatment.)
- **Sections** with mono eyebrow headers: `px-[18px] pt-3.5 pb-1 text-[10px] text-brand-accent uppercase tracking-[0.9px]`. Reference sections: *Library / Manage / Account* (Manage is role-gated).
- **Nav item:** `flex items-center gap-2.5 py-2.5 px-[18px] text-[13px] border-l-[3px] transition-colors`. 15px lucide icon at `opacity-85`.
  - Active: `bg-white/[0.13] text-sidebar-fg border-brand-accent` (3px lime left-border is the active marker).
  - Inactive: `text-sidebar-fgSoft border-transparent hover:bg-white/[0.07]`.
- **Footer:** avatar + name (`text-[12px] text-sidebar-fgSoft`) + role (`text-[10px] text-brand-accent`), separated by `border-t border-white/10`.
- Scrollbar hidden: `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.

### TopBar + FilterBar (per-page chrome)
- **TopBar:** `bg-surface-card border-b border-edge-soft px-[22px] py-2.5 flex items-center gap-2.5`; title 15px semibold; actions pushed right with `ml-auto`; includes a theme toggle.
- **FilterBar:** `bg-surface-card border-b border-edge-soft px-[22px] py-2 flex items-center gap-[7px] flex-wrap` holding chips, selects, labels, dividers.

---

## 6. Component recipes (copy these class strings)

### Primary button
```
px-3.5 py-1.5 rounded-[6px] text-[12px] flex items-center gap-1.5 transition-colors disabled:opacity-50
bg-brand text-brand-pale border border-brand hover:bg-brand-hover
```
### Secondary / default button
```
px-3.5 py-1.5 rounded-[6px] text-[12px] flex items-center gap-1.5 transition-colors disabled:opacity-50
bg-surface-card text-brand border border-edge-chip hover:bg-surface-chipActive
```
### Filter chip
```
inline-flex items-center px-2.5 py-[3px] rounded-[20px] text-[11px] border transition-colors
active:   bg-surface-chipActive text-brand-deep border-edge-chip
inactive: bg-surface text-ink-soft border-edge-soft hover:border-brand-accent
```
### Select (filter)
```
px-2 py-1 border border-edge-chip rounded-[5px] text-[12px] bg-surface-hover text-ink outline-none focus:border-edge-focus cursor-pointer
```
### Data table (container + parts)
```
container: overflow-x-auto rounded-[10px] border border-edge-soft bg-surface-card
thead:     bg-surface-thead
th:        px-3 py-2.5 text-[11px] font-semibold text-brand-deep border-b border-edge-chip whitespace-nowrap
td:        px-3 py-2.5 text-[12.5px] text-ink border-b border-edge-soft align-middle
row hover: hover:bg-surface-hover
empty:     py-12 text-center text-ink-soft text-sm
```
(Reference table also supports drag-to-resize columns persisted to localStorage, and `hiddenOnMobile` columns — nice-to-have, not core to the look.)

### Stat card
```
bg-surface-card border border-edge-soft rounded-[10px] px-5 py-4 flex items-start gap-4
icon:  text-brand-accent
label: text-[11px] uppercase tracking-wide text-gray-500
value: text-2xl font-semibold text-gray-900
hint:  text-[11px] text-gray-500
```
### Doc-type badge
```
inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-semibold
+ bg-badge-{type}-bg text-badge-{type}-fg   (type ∈ contract|invoice|report|letter|permit|other)
```
### Status dot (label + dot)
```
inline-flex items-center gap-1.5 text-[11.5px] text-gray-700
dot: w-[7px] h-[7px] rounded-full + bg-dot-{done|progress|pending|failed}
```
### Approval / workflow pill
```
use bg-approval-{state}-bg text-approval-{state}-fg border border-approval-{state}-edge
state ∈ pending|approved|rejected|revision
```

---

## 7. Auth / hero / editorial surfaces (the showpiece)

This is where the archival aesthetic is loudest. Reproduce faithfully on login/landing/marketing/empty states.

### Split-screen auth layout
```
min-h-screen grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-paper text-ink font-brand
├─ Left: HeroPanel  (bg-brand-deep text-paper, hidden on mobile)
└─ Right: form panel (bg-paper bg-grain-light bg-blend-multiply)
```

**HeroPanel (deep-green editorial column):**
- Background `bg-brand-deep`, with: a warm radial glow `bg-[radial-gradient(circle,#3c6a1c_0%,transparent_65%)] opacity-55` from upper-left; a grain overlay `bg-grain opacity-[0.16] mix-blend-screen`; a 1px ruled "ledger margin" line down the right edge `bg-brand-accent/20`; a thin horizontal rule near the top `bg-paper/10`.
- Brand strip top-left; hero `<h2>` in `font-display` 48–64px with one **italic `text-brand-light`** line; subtitle in `text-brand-light/90`.
- Footer meta row: two `font-mono uppercase` micro-labels (e.g. a tagline left, `N° 01` right) in `text-brand-accent` / `text-paper/40`.

**Floating archive catalog cards** (the signature ornament — two tilted "library cards"):
- White `bg-paper` cards, sharp corners, `shadow-[0_22px_44px_-18px_rgba(0,0,0,0.45)] ring-1 ring-paper-edge`.
- **Tick-mark corners:** 8 absolutely-positioned `w-3 h-px` / `w-px h-3` `bg-ink/40` marks at each corner.
- **Perforation row:** 18× `w-[3px] h-[3px] rounded-full bg-ink` at `opacity-40`.
- Header: mono eyebrow "Archive Card · 2026" + big mono `DOC-0xxxxx` + a tiny outlined language tag.
- Title in `font-display italic`.
- Metadata as a 2-col `<dl>`, `font-mono text-[10.5px]`, each row `border-b border-dashed border-ink/15`.
- Footer status line with a `bg-dot-done` dot + "Indexed".
- **Rubber stamp:** rotated `rotate-[14deg]`, `border-[1.5px] border-red-700/80 text-red-700/85 bg-paper/60 backdrop-blur-[1px]`, mono uppercase "APPROVED" + year — pulses via `animate-stamp`.
- Cards drift with `animate-float1` / `animate-float2`.

### Form fields on paper (underline style)
- **Field label:** `font-mono text-[9.5px] tracking-[0.24em] uppercase text-ink-soft mb-2`.
- **Input:** underline-only — `w-full bg-transparent border-0 border-b border-ink/25 focus:border-brand outline-none py-2 text-[15px] text-ink placeholder:text-ink/30 transition-colors`.
- **Submit:** full-width green stamp button — `py-[14px] px-5 bg-brand hover:bg-brand-hover text-paper font-mono text-[11px] tracking-[0.26em] uppercase`, with a label left and a sliding rule + `→` arrow right that extends on hover (`w-6 h-px bg-paper/40 group-hover:w-10`, arrow `group-hover:translate-x-[3px]`).
- **Inline error:** `border-l-2 border-red-700 bg-red-700/5 px-3 py-2 text-[12.5px] text-red-800`.
- **Language switcher (pill group):** `inline-flex border border-paper-edge bg-paper/60 rounded-full p-[3px]`; each option `font-mono text-[10px] tracking-[0.18em] uppercase`, active `bg-brand text-paper`.

---

## 8. Motion & texture utilities

```css
/* Keyframes */
@keyframes riseFade { from {opacity:0; transform:translateY(14px)} to {opacity:1; transform:translateY(0)} }
/* card float (two variants, slow rotate+bob), stamp pulse */

/* Tailwind animation tokens */
rise:   riseFade 0.8s cubic-bezier(0.2,0.65,0.2,1) both
float1: cardFloat1 9s ease-in-out infinite   /* rotate -5.5°↔-5°, bob -7px */
float2: cardFloat2 11s ease-in-out infinite  /* rotate 4°↔3.5°, bob -5px */
stamp:  stampPulse 4s ease-in-out infinite   /* opacity 0.78↔1 */
```
- **Staggered entrance:** wrap a group in `.stagger`; children fade-rise with incremental delays (0.05s steps, up to ~7 children).
- **Paper grain:** `.bg-grain` (light-on-dark) and `.bg-grain-light` (dark-on-light) are inline SVG `feTurbulence` data-URLs at `background-size: 320px`. Use at low opacity under hero/auth panels.
- **Search-match highlight:** `ts_headline`/`<mark>` results styled as `color: brand-deep; font-weight:600; box-shadow: inset 0 -2px 0 brand-accent/0.45` (a subtle underline, not a yellow highlight).

Honor `prefers-reduced-motion` if you add more motion.

---

## 9. Theming mechanics

- `data-theme="light|dark"` is set on `<html>`. A tiny inline `<head>` script reads a `NEXT_THEME` cookie (or `localStorage`, or `prefers-color-scheme`) and sets `data-theme` + `style.colorScheme` **before paint** to avoid a flash. Tailwind dark mode is configured as `darkMode: ["class", "[data-theme='dark']"]`.
- A `ThemeProvider` + `ThemeToggle` manage the `light | dark | system` preference (persisted to the cookie).
- **Named-gray dark overrides:** in `@layer base`, `[data-theme="dark"] .text-gray-900` → bright, `.text-gray-500` → mid, `.bg-gray-50/100` → lifted-dark, `.border-gray-*` → visible-on-dark, plus a handful of `.text-red-*/.text-green-*/.bg-red-*` flips. Port these if the target uses raw Tailwind color utilities.
- **Autofill fix:** Chrome autofill is masked with `-webkit-box-shadow: 0 0 0 1000px rgb(var(--paper)) inset; -webkit-text-fill-color: rgb(var(--ink)); transition: background-color 5000s` so autofilled text stays legible on cream/dark surfaces.

---

## 10. Iconography & i18n

- **Icons:** `lucide-react`, drawn small (14–16px) and de-emphasized (`opacity-85`). Outline style only; never filled/duotone.
- **i18n:** the platform is trilingual (English / Azerbaijani / Russian) via cookie-based locale (not URL prefix). Keep all user-facing strings translatable. The mono uppercase labels often render Latin-extended characters — pick fonts with `latin-ext` coverage (Fraunces & JetBrains Mono both have it).

---

## 11. Do / Don't

**Do**
- Lead with warm paper + deep forest green; use the lime `brand-accent` only for small accents (active markers, eyebrows, rules, icons).
- Use mono-uppercase-wide-tracking for every label/eyebrow/ID — it's the signature.
- Keep working surfaces dense, flat, border-defined, calm.
- Save the archival ornament (tick corners, perforations, stamps, ledger rules, floating cards) for hero/auth/empty/marketing surfaces.
- Build dark mode as a token flip with cool slate + muted sage.

**Don't**
- Don't use pure white page backgrounds (use `surface` #f4f6f3) or pure-black dark backgrounds (use slate #0e1218).
- Don't make the green loud everywhere — it's a serious dark green, accented by lime, not a bright emerald UI.
- Don't add heavy drop-shadows or glassy gradients to the working UI.
- Don't round the editorial archive cards — they read as paper stock.
- Don't reach for Tailwind `border-*`/`bg-white` for chrome; use the `edge-*` / `surface-*` tokens so theming holds.
- Don't introduce a 4th font or bouncy/fast motion.

---

## 12. Quick-start checklist for the target codebase

1. Drop the CSS variables from §2 into a `@layer base` block under `:root`/`[data-theme]`, plus the dark overrides from §9.
2. Configure Tailwind: `darkMode: ["class","[data-theme='dark']"]` and map `brand/paper/ink/surface/edge/badge/approval/dot/sidebar` colors to the vars via `rgb(var(--x) / <alpha-value>)`; add `font-display/brand/mono` families and the `rise/float1/float2/stamp` keyframes+animations (§8).
3. Load Fraunces + JetBrains Mono; set the Calibri stack on `html`.
4. Add the pre-paint theme `<head>` script + autofill CSS (§9).
5. Add `.stagger`, `.bg-grain`, `.bg-grain-light`, and search-highlight utilities (§8).
6. Build the shell: 210px dark-green Sidebar + thin top header + scrolling main (§5).
7. Re-skin components using the recipes in §6 and the full catalog in §14.
8. Re-skin auth/landing with the split-screen hero + floating archive cards (§7) — adapt copy/wordmark to the target product.

---

## 13. DataTable — full behavior (responsive + resizable columns)

The reference table is more than a styled `<table>`; it carries three behaviors worth reproducing for a pixel-identical feel. All are progressive enhancements — the visual recipe in §6 stands on its own without them.

**Column model**
```ts
type Column<T> = {
  key: string;
  header: ReactNode;
  width?: string;            // initial width, e.g. "180px"
  align?: "left" | "center" | "right";
  hiddenOnMobile?: boolean;  // dropped below 768px
  render: (row: T) => ReactNode;
};
```
Props: `columns`, `rows`, `rowKey(row)`, `empty` (empty-state node), `minWidth` (default 900 — table is `tableLayout:fixed` and horizontally scrolls below this), `storageKey` (enables width persistence).

**1. Responsive column hiding.** A `useIsMobile(768)` hook (matchMedia, subscribes to `change`) filters out `hiddenOnMobile` columns under 768px. Put low-priority columns (dates, secondary metadata) behind this flag; keep title + status visible on mobile.

**2. Drag-to-resize columns.** Each `<th>` is `relative group` and renders a 4px resize handle pinned to its right edge:
```
absolute right-0 top-0 h-full w-[4px] cursor-col-resize select-none
opacity-0 group-hover:opacity-100 transition-opacity
hover:bg-edge-chip          (idle)
opacity-100 bg-brand/40     (while dragging this column)
```
On `mousedown` it records `{colKey, startX, startWidth}` (startWidth = stored width, else measured from the rendered `<th>`); window `mousemove` sets `width = max(40, startWidth + deltaX)`; `mouseup` ends the drag. Widths live in a `colWidths` state map and are applied as inline `width:${px}px` on both `<th>` and `<td>`.

**3. Width persistence.** When `storageKey` is set, `colWidths` is hydrated from `localStorage["dt-cols-{storageKey}"]` on mount and written back (debounced 300ms) on change. Wrap reads/writes in try/catch to tolerate quota/serialization errors.

**Effective width resolution:** explicit drag width (state) → `column.width` prop → auto. **Empty state:** a single full-span row, `py-12 text-center text-ink-soft text-sm`.

---

## 14. Full component catalog

Every remaining element, with copy-paste recipes. These all use the §2 tokens (except the deliberately-hardcoded sticky-note in §14.10 — see its note).

### 14.1 Avatar (round, image-or-initials)
Round chip that prefers the uploaded image and falls back to brand-colored initials. Because the avatar endpoint needs a Bearer token (which `<img>` can't send), the image is fetched as a blob via the API client and rendered as an object URL; cache-busted by `updated_at`.
```
base: rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden
      bg-brand-chip text-brand-pale font-semibold
img:  w-full h-full object-cover
sizes (px / text): xs 22/9px · sm 28/10px · md 32/11px · lg 48/14px · xl 96/28px
```

### 14.2 ApprovalBadge (bordered pill)
```
inline-block px-2 py-0.5 rounded-[10px] text-[10px] font-semibold border
+ bg-approval-{state}-bg text-approval-{state}-fg border-approval-{state}-edge
state ∈ pending | approved | rejected | revision_requested
```

### 14.3 ThemeToggle (icon button, cycles light→dark→system)
Square 32px icon button cycling the three prefs; icon is Sun / Moon / Monitor for light / dark / system.
```
inline-flex items-center justify-center w-8 h-8 rounded-[6px]
border border-edge-chip bg-surface-card text-ink-soft
hover:text-brand hover:bg-surface-chipActive transition-colors
icon: w-4 h-4
```

### 14.4 Language switcher (mono pill group)
Two variants share one look — a rounded-full segmented control of mono uppercase locale codes. The app-chrome variant uses tokens; the auth variant uses `paper`/`brand`.
```
group:  inline-flex items-center border border-edge-chip rounded-full p-[2px] bg-surface-card
item:   px-2 py-0.5 text-[10px] font-mono tracking-[0.18em] uppercase rounded-full transition-colors
active: bg-brand text-brand-pale
idle:   text-gray-500 hover:text-brand
(auth variant: border-paper-edge bg-paper/60, active bg-brand text-paper, idle text-ink-soft)
```

### 14.5 Modal / dialog (UploadModal pattern)
The canonical overlay: dim scrim + centered card with header / scrollable body / footer action row.
```
scrim:  fixed inset-0 z-50 flex items-center justify-center bg-black/30
card:   bg-surface-card rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-edge-soft
header: px-6 py-4 border-b border-edge-soft flex items-center justify-between
        title text-[15px] font-semibold text-gray-900; close = X icon, text-gray-400 hover:text-gray-700
body:   p-6 space-y-4
footer: px-6 py-3 border-t border-edge-soft flex items-center justify-end gap-2  (Cancel = secondary btn, confirm = primary btn from §6)
```
**Form field inside modal** (compact label + control):
```
label: block text-[11px] text-gray-600 mb-1
input/select: w-full px-2 py-1.5 border border-edge-chip rounded-[5px] text-[12px]
              bg-surface-hover outline-none focus:border-edge-focus
2-col metadata grid: grid grid-cols-2 gap-3
```

### 14.6 Dropzone + file-upload list
```
dropzone:        border-2 border-dashed rounded-[10px] p-6 text-center cursor-pointer transition-colors
  idle:          border-edge-chip hover:border-brand-accent hover:bg-surface-hover
  drag-active:   border-brand-accent bg-surface-hover
  icon Upload w-7 h-7 text-gray-400; hint text-xs text-gray-500; "browse" link text-brand font-medium
file row:        flex items-center gap-3 border border-edge-soft rounded-md px-3 py-2
progress track:  h-1 bg-gray-200 rounded-full overflow-hidden
progress fill:   h-full bg-brand-accent rounded-full transition-all  (width = %)
status icons:    uploading Loader2 animate-spin text-brand-accent · done CheckCircle text-dot-done · error AlertCircle text-red-500
```

### 14.7 Notifications bell + dropdown
```
trigger:   relative p-1.5 rounded-md hover:bg-surface-hover text-gray-600 (Bell w-4 h-4)
badge:     absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-semibold
panel:     absolute right-0 mt-2 w-[340px] bg-surface-card border border-edge-soft rounded-lg shadow-lg z-40
header:    flex items-center justify-between px-3 py-2 border-b border-edge-soft
           title text-[13px] font-semibold text-brand; "mark all" text-[11px] text-brand-deep hover:underline
item:      w-full text-left px-3 py-2 border-b border-edge-soft last:border-b-0 hover:bg-surface-hover
           unread: bg-surface-hover + leading dot (w-1.5 h-1.5 rounded-full bg-brand-accent)
           body text-[12.5px] text-gray-800; reason italic text-gray-500; timestamp text-[10px] text-gray-400
empty:     p-4 text-[12px] text-gray-500 italic text-center
```
Pattern: closes on outside `mousedown`; polls every 10s; revalidates on open.

### 14.8 SearchBar (editorial oversized input)
A signature surface — not a boxed input but a big serif line over a single ruled underline, with a mono submit chip. Press `/` anywhere to focus.
```
row:    relative flex items-center gap-3 pb-2.5 border-b transition-colors
        focused: border-brand-accent · idle: border-edge-chip group-hover:border-brand-accent/60
icon:   Search w-5 h-5 strokeWidth=1.5, text-brand when focused else text-ink-soft
input:  flex-1 bg-transparent outline-none border-0 py-2 text-[22px] md:text-[26px]
        font-display font-light tracking-tight text-ink placeholder:text-ink-soft/55 placeholder:italic
clear:  w-7 h-7 grid place-items-center rounded-full text-ink-soft hover:bg-surface-hover (X)
submit: inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-[1.2px] font-medium
        text-brand-deep border border-edge-chip rounded-[4px] bg-surface-card hover:bg-surface-chipActive
        loading: a w-3 h-3 rounded-full border border-brand border-t-transparent animate-spin
```

### 14.9 Search results (archival "record" cards)
List with `.stagger` entrance; each result is a card with a doc-type-colored left rule and editorial typographic hierarchy.
```
card:    group block relative pl-5 pr-4 py-4 rounded-[6px] bg-surface-card border border-edge-soft
         hover:border-edge-chip hover:bg-surface-hover transition-colors
left rule: absolute left-0 top-3 bottom-3 w-[3px] rounded-r-sm  + bg-badge-{type}-fg  (color encodes doc type)
eyebrow:  flex items-center gap-2 text-[10.5px] uppercase tracking-[1.4px] text-ink-soft
          DOC id = font-mono text-brand-deep; separators = "·" in text-edge-chip
title:    font-display text-[18px] md:text-[19px] font-medium text-ink leading-snug
snippet:  .search-snippet mt-2 text-[13.5px] leading-relaxed text-ink-soft line-clamp-3  (HTML from ts_headline; see highlight style §8)
footer:   text-[11px] text-ink-soft — page no. + mono relevance %; "Open ›" appears on hover (text-brand, opacity-0 group-hover:opacity-100)
```

### 14.10 Comment bubble — **Word-style margin sticky note** (intentional exception)
The document margin comments deliberately break the token palette to read as classic Word/Google-Docs yellow sticky notes. **Keep these hardcoded hex values** — they are part of the identity of this surface, not a mistake.
```
unresolved: bg-[#fffbeb] border border-[#fde68a] border-l-[3px] border-l-[#facc15]
resolved:   bg-[#f9f9f9] border border-[#ddd] border-l-[3px] border-l-[#ccc] opacity-50
active:     ring-2 ring-yellow-400 shadow-md
shell:      rounded-[6px] shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] p-[10px] text-[11px]
author:     font-semibold text-[11px] text-[#333]; time text-[9px] text-[#999]
body:       text-[#555] leading-[1.5]
reply send btn: bg-[#facc15] hover:bg-[#eab308] text-[#333] text-[9px] font-medium
divider between replies: border-t border-[#fde68a]
@mention dropdown: bg-white border border-[#fde68a] rounded shadow-lg; active row bg-[#fffbeb]
```

### 14.11 PDF DocumentViewer (reading-room toolbar)
A reader surface that sits on a neutral gray stage (not the cream/green chrome) so the page itself is the focus; a token-styled toolbar floats above it.
```
stage:   flex flex-col bg-gray-100 h-full overflow-hidden  (fullscreen: fixed inset-0 z-50 bg-gray-900)
toolbar: w-full flex items-center justify-between px-4 py-2 bg-surface-card border-b border-gray-200
buttons: p-1 rounded hover:bg-gray-100 disabled:opacity-40  (Chevrons, ZoomIn/Out, RotateCw, Maximize2)
readout: text-sm text-gray-600 tabular-nums  (page x / y, zoom %)
page:    react-pdf <Page> with className "shadow-lg" on a p-4 centered scroll area
OCR btn: px-2 py-1 text-[11px] border border-edge-chip rounded-[5px] hover:bg-surface-hover
margin:  240px comment column to the right of the page on desktop (hidden < 768px)
```

### 14.12 Chat — letter-style transcript (no bubbles)
The AI chat is styled as a typed letter/transcript, **deliberately bubble-free**. Speaker is shown by a 2px accent rule on the outer edge + a mono label, not chrome.
```
column:        narrow centered, max-w-[760px] at page level; turns separated by space-y-7
user turn:     border-r-2 border-brand-accent pr-4 ml-12   (right-aligned, label justify-end)
assistant turn:border-l-2 border-edge-soft pl-4 mr-12      (left-aligned)
speaker label: font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-soft  (e.g. "YOU" / "ARCHIVE")
body:          mt-1 text-[14px] leading-[1.65] text-ink whitespace-pre-wrap
streaming caret: text-ink-soft animate-pulse "▋"
citations:     flex-wrap text-[11px] text-ink-soft — DOC id (font-mono text-brand-deep) + title
               (underline decoration-edge-chip group-hover:decoration-brand) + "p.{n}"
API-error turn:mx-4 px-4 py-3 rounded-[8px] bg-approval-pending-bg border border-approval-pending-edge
               text-approval-pending-fg, AlertTriangle icon + message
composer:      border-t border-edge-soft px-6 pt-3 pb-4
  textarea:    flex-1 resize-none px-3 py-2 bg-transparent border border-edge-chip rounded-[6px]
               outline-none focus:border-edge-focus text-[14px] max-h-32 (auto-grow, Enter sends / Shift+Enter newline)
  send btn:    p-2 text-ink-soft hover:text-brand disabled:opacity-30 (Send w-4 h-4)
  kbd hint:    mt-1.5 text-[10.5px] text-ink-soft/70 font-mono uppercase tracking-[0.18em]
```

### 14.13 Chat "Reading Room" welcome / empty state
Shown before the first message — a centered editorial panel (`max-w-[560px]`) that showcases the archival voice. Reuse this pattern for any feature's empty state.
```
eyebrow:  font-mono text-[10px] uppercase tracking-[0.32em] text-brand-accent  (e.g. "Reading Room · AI")
heading:  font-display text-[26px] leading-[1.15] text-brand-deep (centered)
subhead:  text-[13.5px] leading-relaxed text-ink-soft max-w-[44ch] mx-auto
SectionRule: a centered label between two hairlines —
             flex items-center gap-3 · h-px flex-1 bg-edge-soft on each side ·
             label font-mono text-[9.5px] uppercase tracking-[0.28em] text-ink-soft/70
steps grid:  grid grid-cols-3 gap-px bg-edge-soft border border-edge-soft rounded-[3px] overflow-hidden
             (cells bg-surface-card px-4 py-5; numbered "01" in font-mono text-brand-accent; title font-display)
example rows:button w/ border border-edge-soft rounded-[3px] hover:border-brand-accent/60 hover:bg-surface-hover;
             number (mono) + italic font-display quote (text-brand-deep) + CornerDownLeft icon
benefit list:"·" bullet in text-brand-accent + text-[12.5px] text-ink-soft
```

### 14.14 Password strength meter
```
track: flex gap-1.5 of 4 segments — each h-[3px] flex-1 transition-colors
       filled bg-brand-accent · empty bg-ink/10  (fill count: weak1 fair2 good3 strong4)
label row: font-mono text-[9.5px] tracking-[0.22em] uppercase text-ink-soft, label left / bucket right
```

### 14.15 Folder breadcrumb (table cell)
```
text-[11.5px] text-gray-600 inline-flex items-center gap-0.5
segments joined by ChevronRight w-3 h-3 text-gray-400; last segment text-gray-800 font-medium
empty/none: "—" in text-[11.5px] text-gray-400
```
(FolderPicker itself reuses the standard select recipe from §14.5.)

### 14.16 Inline spinners
- Button/inline: `w-3 h-3 rounded-full border border-brand border-t-transparent animate-spin`.
- Block/loading: lucide `Loader2 animate-spin`, `text-gray-400` (or `text-brand-accent` on-brand).

---

## 15. Cross-cutting conventions (apply everywhere)

- **"—" for empty values.** Missing metadata renders an em dash in `text-gray-400` at the cell's text size, never a blank.
- **Mono + uppercase + wide tracking = "this is metadata/a label/an ID."** Use it for eyebrows, IDs, status text, kbd hints, locale codes, section rules. This single treatment carries most of the brand.
- **`font-display` (serif) = "this is editorial."** Titles, hero, quotes, search-result titles, welcome headings — often *italic* for quotes/accents.
- **Color-as-data:** doc-type hue appears as a badge fill (§6) and as a 3px left rule on search cards (§14.9). Keep a type→hue mapping consistent across the app.
- **Hover reveals, doesn't shout:** secondary actions (resize handles, "Open ›", row action icons) sit at `opacity-0` and fade in on `group-hover`.
- **Focus = brand:** inputs move their border to `edge-focus`/`brand-accent` on focus; never a default browser outline (set `outline-none` + a border change).
- **Accent restraint:** lime `brand-accent` is for tiny signals only (active nav rule, dots, numbers, hairline accents). Primary actions use the deep `brand` green.
- **Reading surfaces go neutral:** the PDF viewer drops to gray (`bg-gray-100`/`gray-900`) so content leads; chrome around it keeps the tokens.
