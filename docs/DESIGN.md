# Wiege — design system

This is the visual and interaction contract for Wiege. Engineers implement it in **Next.js 16 (App
Router) + Tailwind CSS v4 (CSS-first `@theme` in `src/app/globals.css`) + `motion` (`motion/react`)**.

- `docs/SPEC.md` owns behaviour, data, architecture and scope. This file owns how things look,
  move and read. When they disagree on visuals, this file wins; on behaviour, SPEC wins.
- The reference mockup is `scratchpad/design/final/index.html` (landing page plus app screens:
  `/today`, `/words` with a flashcard, the mobile tab bar, the reader's word sheet). Screenshots:
  `desktop.png`, `desktop-dark.png`, `mobile.png`, `mobile-dark.png`, `chromebook-1366.png`.
  Where the mockup and this file differ, this file wins.
- Every number in this file is a decision. If something is not specified, use the nearest token;
  never invent a new colour, radius, shadow, easing or font size.

**Accounts.** The owner's brief says "anyone can log in and use it". SPEC.md §1 decides there are
no accounts: progress lives on the device, and nothing asks for a login. Every screen here is
designed for that model. Section 12.11 still specifies `/login` and `/signup` in case the owner
turns accounts on later. Until SPEC changes, do not build them and do not mention accounts in the UI.

**Readability revision (owner feedback, 2026-09-27: "some fonts are hard to read"). This
supersedes anything below that conflicts:**
- **Bodoni Moda only for big, short display moments:** `display-xl` (now weight 800), `h1`, `h2`,
  cover words, flashcard words, category tile names, the wordmark, the 404 numeral and the closing
  CTA headline (min 32px). Never for story titles, card titles, the reader headline, block headings
  (`h3`/`h4`), headwords or anything a student reads as a sentence at under 32px.
- **Mid-size titles use Literata 700** via `font-title` / `--font-title`: `h3` 28/24, `reader-title`
  33/27, `h4` and card titles 22/20, `note-word` 30. Use the `type-*` roles or `font-title` +
  `font-bold`; never `font-display` below 32px.
- **No handwriting font.** Nanum Pen Script is removed. `type-hand` asides are Literata italic
  17/18px and are never rotated.
- **Digits come from Literata** (a 4.6 KB digits-only cut, `--font-digits`, first in the UI stack),
  because Atkinson's slashed zero reads as "Ø". Keep `tabular-nums` for counts.
- The families are now three (Bodoni, Literata, Atkinson) plus the digits cut.

---

## 0. Decision record (why this system looks like this)

Three directions were explored and judged twice (brief fit + craft):

| Direction | Brief judge | Craft judge | Total | Verdict |
|---|---|---|---|---|
| Marginalia (pen notes in a folio margin, Bodoni + Literata) | 60 | **66.5** | **126.5** | **Base** |
| Kinetic Type (width-axis grotesque, squeeze-and-slip headline) | **64** | 62 | 126 | Grafts only |
| Linocut Zine (stamps, halftones, photocopy texture) | 56 | 60 | 116 | Grafts only |

**Why Marginalia is the base:** it is the only direction that covers the owner's word *fancy*. It
is the only one that meets the reading-measure constraint (it was measured at 65–67 characters per
line, and the final system gets 56–70). Its signature *is* the skill being taught: annotating a text
is close reading. It is one reusable, deterministic SVG primitive, so it server-renders without a
hydration mismatch. SPEC already asks for "margin notes beside the paragraph" on desktop.

**What was wrong with Marginalia, and how the final system fixes it:**

| Judge finding | Fix in the final system |
|---|---|
| Reads as a literary magazine or perfume ad; not exciting for 13-year-olds | Bodoni at **800–900** (fat-face poster weight, not 400 hairline). Teen-coded practice content (speedrunning, skate parks, relays). Scoreboard counters (nav Words count, "0 of 3 words kept"). Honest "Next drop in 1 h 52 min" countdown. Jersey-style numerals in Atkinson 800. The student holds the pen: marks appear because *they* tapped, saved or practised. |
| Boldness spent twice (pen marks + speckled rubber stamps with tracked caps) | One signature only: the pen. Stamps (badges) are pen-drawn seals with no speckle filter, no text on a path and no caps. |
| Loops cut into neighbouring letters ("national(slam") | The loop is now an aspect-aware rounded rectangle whose sides stay inside the word space. Its overshoot tail lands above the word, never on a neighbour (§8.3). |
| A comma started a new line (inline-block tap target) | A tap word and its trailing punctuation are wrapped in one `nowrap` span (§8.6). |
| Interlinear feedback notes were `::before` content, fragile, not selectable | Feedback notes are real DOM text linked with `aria-describedby`. They sit in the margin on desktop and in a list under the draft on mobile. Marks in the draft are inline SVG that reflows with the text (§11.12). |
| Cover words cropped mid-letter ("protot") | Cover words are fitted to the cover width exactly and never cropped (§8.9). |
| "Key word, noun" labels looked like template text | Removed. The cover is the word alone, plus the category glyph. |
| Quiz choices didn't look tappable | Choices are bordered 12px-radius cards with a lettered circle, and hover/focus states (§11.10). |
| Hairlines vanish; "14" reads "I4" | Bodoni is used only at 20px and up, at weight 700–900, with optical sizing on. **All numerals are set in Atkinson Hyperlegible Next**, because Bodoni's `1` has no flag and reads as `I` at every optical size (tested). |
| Folio grid falls apart on mobile | Mobile gets explicit patterns: the note goes *inline* under the block in the landing demos, and into a *non-modal bottom sheet* in the reader. |
| Dark mode looked like a plain inversion | Dark mode is "white gel pen on a black sketchbook": `--pen-w` goes from 2px to 2.4px, pen marks get a 0.6px gel sheen, surfaces use `--sheet #141414`, and reading text is `#EBEBEB` to cut halation. |
| Four font families, heavy payload | Four families kept, each with one job, but with a trimmed budget: Bodoni normal style only; Literata without the opsz axis; Atkinson normal only; Nanum Pen Script latin subset, not preloaded (§3). |

**Grafts:**
- **From Kinetic:**
  - The "Say it" respelling plus "Rhymes with" line, and the "In this story" usage line.
  - The persistent Words count in the nav.
  - Mastery made visible, translated into pen marks (§8.8).
  - Labelled tap buttons ("rehearse: show what it means") and a screen-reader mirror for drawn headlines.
  - "Your first try" and "Right answer" labels plus a hatch strip, instead of colour.
  - Visible choice boundaries.
- **From Linocut:**
  - The "0 of 3 words kept" collection meter.
  - Honest drop language with a countdown.
  - An example sentence in every note.
  - "N new today" counts on the category tiles.
  - "Free. No sign-up." directly beside the first CTA.
  - Contrast ratios written next to every token.
  - A real dark sheet surface.

**Rejected on purpose:**
- **Kinetic's width-axis squeeze.** It would be a second signature, it depends on a client line solver on the LCP element (layout shift), and it thins neighbouring words to hairlines in a literacy app.
- **Linocut's speckle and grit filters.** They put noise behind text and add paint cost on school Chromebooks.
- **Any second typeface for "energy".**

---

## 1. Concept

**Marginalia, loud.** Every story in Wiege is a page you are allowed to write on. The interface
is set like a well-made book: a printed left margin, a text column and a right margin. A sharp
student's pen does its work in that right margin. The type is dressed up (Bodoni Moda at poster
weight, true black on true white). Everything the pen does is personal: it circles the word *you*
tapped, ticks the answer *you* got, underlines the phrase *you* wrote well, and draws the tally of
days *you* read.

The one-line pitch for anyone building a screen: **fancy type, one pen, and the student holds it.**

---

## 2. Principles

1. **One pen, and it only marks meaning.** The pen is the single signature element (§8). It appears
   only where a real reader would write on a page: around a word you're learning, on an answer, on
   your own writing, and on your progress. It never decorates headings, backgrounds, buttons,
   section breaks, loaders or empty space.
   - **Allowed:**
     - the loop around a tapped word, and the arrow and bracket of its margin note
     - squiggles and underlines that show a word's mastery
     - the tick, cross and strike on quiz answers
     - the caret and underlines in writing feedback
     - tally marks, progress lines, the words-kept meter boxes and the stamp seals
     - one mark on the key word of a story cover
     - the active-tab underline in the mobile tab bar
     - handwritten asides (§3.4)
   - **Not allowed:** anything else.
2. **Fancy type, plain words.** Bodoni Moda 800–900 carries the "fancy" of the brief at 20px and
   above. Every sentence is written in plain, sentence-case English a 12-year-old reads without
   effort. The type dresses up; the copy never does.
3. **The reading column is sacred.** Long-form text is Literata at 18–24px with 1.72 line height,
   56–70 characters per line (max-width `32em`), on plain `--paper`. Nothing moves, overlaps or
   sits behind reading text. Word notes never cover the paragraph being read.
4. **Black, white and grey only; states by shape.** There is no hue anywhere, including errors and
   success. State is shown by inversion (fill), border weight and style (solid, dashed, 2px),
   a pen mark (tick, cross, loop), a hatch strip, an icon and a text label. Every state has a text
   label or accessible name, so meaning never depends on appearance alone.
5. **Give before you ask, and show what's stored.** A visitor uses the real tap-a-word tool before
   they are asked for anything. What a student builds (words, journal, streak, stamps) is always
   visible and always theirs: countable, exportable and deletable.
6. **Quiet everywhere else.** Outside the pen, the system is disciplined:
   - pill buttons and 4px paper corners
   - 1px borders and no shadows
   - an 8px spacing rhythm
   - one filled action per viewport
   - one orchestrated motion moment per page
7. **Numbers are for reading, not for show.** Every numeral is Atkinson Hyperlegible Next with
   tabular figures. Counts are real data. There are no invented users, ratings or testimonials.

---

## 3. Typography

### 3.1 Families (all verified in Next 16.3's `next/font/google` font data)

| Role | Family | `next/font/google` export | Axes / weights / styles loaded | CSS variable |
|---|---|---|---|---|
| Display: wordmark, headings, story titles, note headwords, cover words, flashcard words | Bodoni Moda | `Bodoni_Moda` | variable `wght` 400–900 + `opsz` 6–96; style `normal` only | `--font-bodoni` |
| Reading: standfirst, story text, quiz questions and choices, prompts, drafts, example sentences, "Latest" headlines | Literata | `Literata` | variable `wght` 200–900; styles `normal` + `italic`; no `opsz` axis (default instance) | `--font-literata` |
| UI and numerals: nav, buttons, labels, meta, definitions, forms, captions, all numbers, and the "Clear" reading font | Atkinson Hyperlegible Next | `Atkinson_Hyperlegible_Next` | variable `wght` 200–800; style `normal` | `--font-atkinson` |
| Digits in all UI text (plain zero) | Literata 0–9 cut | `next/font/local` (`src/app/_fonts/literata-digits.woff2`) | variable `wght` 200–900, `unicode-range: U+0030-0039` | `--font-digits` |

`src/app/fonts.ts`:

```ts
import { Atkinson_Hyperlegible_Next, Bodoni_Moda, Literata, Nanum_Pen_Script } from 'next/font/google';

export const bodoni = Bodoni_Moda({
  subsets: ['latin'], style: ['normal'], axes: ['opsz'], display: 'swap',
  variable: '--font-bodoni', fallback: ['Bodoni 72', 'Didot', 'Georgia', 'serif'],
});
export const literata = Literata({
  subsets: ['latin'], style: ['normal', 'italic'], display: 'swap',
  variable: '--font-literata', fallback: ['Georgia', 'Times New Roman', 'serif'],
});
export const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'], style: ['normal'], display: 'swap',
  variable: '--font-atkinson', fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});
export const hand = Nanum_Pen_Script({
  weight: '400', subsets: ['latin'], display: 'swap', preload: false,
  variable: '--font-hand', fallback: ['Bradley Hand', 'Segoe Print', 'cursive'],
});
```

Put all four `.variable` classes on `<html>`. Weights actually used:
- Bodoni 700, 800, 900
- Literata 400 and 600, plus italic 400
- Atkinson 400, 600, 700, 800

Do not load Bodoni italic. The display face never goes italic, and an italic accent word in a
headline is a banned pattern.

### 3.2 Rules
- **Bodoni is never used below 20px, never below weight 700, and never for numerals.** Keep
  `font-optical-sizing: auto` so hairlines thicken at smaller sizes.
- **Numerals are always Atkinson** 700–800 with `font-variant-numeric: tabular-nums lining-nums`.
  This covers counts, step numbers, streak numbers, times, "2 of 5" and stamp numerals. Atkinson's
  slashed zero is a deliberate legibility feature; keep it.
- **Literata** carries all reading. Italic is only for example sentences, parts of speech,
  pronunciation lines and quoted student phrases. Never italicise a word to accent a headline.
- **Atkinson** carries everything you operate. It is also the "Clear" reading font in reading
  settings. When Clear is on: same size, line height +0.05, `max-width: 30em`.
- **Sentence case everywhere.** Never ALL CAPS, never tracked-out eyebrow labels, never monospace.
- `text-wrap: balance` on headings; `text-wrap: pretty` on reading paragraphs.

### 3.3 Type scale

Desktop means 1024px and up; mobile means under 768px. Between the two, the fluid `clamp()` value
applies. Letter-spacing is in em.

| Role | Family / weight | Desktop size/line | Mobile size/line | Tracking | Use |
|---|---|---|---|---|---|
| `display-xl` | Bodoni 800 | 78/81 `clamp(36px,5.4vw,78px)` lh 1.04 | 36/37 | −0.018 | Landing poster headline (the practice story) |
| `h1` | Bodoni 900 | 64/67 | 40/42 | −0.02 | Page titles: "Good afternoon.", "Your words", category names |
| `h2` | Bodoni 800 | 48/51 | 32/34 | −0.015 | Section headings |
| `h3` | **Literata 700** | 28/34 | 24/29 | −0.005 | Block headings ("Continue reading") |
| `reader-title` | **Literata 700** | 33/39 | 27/32 | −0.008 | Story headline in the reader |
| `h4` / card title | **Literata 700** | 22/28 | 20/25 | 0 | Story card titles (tile names stay Bodoni 700 at 38/28) |
| `note-word` | **Literata 700** | 30/35 | 30/35 | −0.005 | Headword in a margin note or sheet |
| `flash-word` | Bodoni 900 | 52/55 | 56/59 | −0.02 | Flashcard word |
| `cover-word` | Bodoni 900 | fit-to-width, max 136 (lh 0.9) | fit-to-width | −0.025 | Story cover key word (§8.9) |
| `standfirst` | Literata 400 | 21/35 (1.65) | 19/31 | 0 | Hero and reader standfirst, max `32em` |
| `read` | Literata 400 | 20/34 (1.72) | 19/33 | 0 | Story text, max `32em`. Settings: S 18, M 20, L 22, XL 24 |
| `question` | Literata 400 | 23/33 | 20/29 | 0 | Quiz question, writing prompt |
| `choice` | Literata 400 | 18/25 | 18/25 | 0 | Quiz choices, "Latest" headlines (17/24), card summaries (17/26) |
| `ui` | Atkinson 400 | 17/26 | 17/26 | 0 | Body UI copy, definitions (min 16 on mobile) |
| `ui-strong` | Atkinson 700 | 17/24 | 16/24 | 0 | Buttons (17), nav links (16) |
| `lead-ui` | Atkinson 800 | 21/28 | 21/28 | −0.005 | Landing pitch (the page `h1`, set in the left margin) |
| `small` | Atkinson 600/700 | 15/22 | 15/22 | 0 | Meta rows, labels, legends |
| `caption` | Atkinson 400/700 | 14/20 | 14/20 | 0 | Micro-copy, stamp captions, hints. **Minimum text size.** |
| `micro` | Atkinson 700–800 | 12/14 | 12/14 | 0 | Only tab-bar labels and count badges |
| `numeral-xl` | Atkinson 800 | 112/90 | 88/72 | −0.05 | Streak number |
| `numeral-l` | Atkinson 800 | 88/70 | 64/52 | −0.04 | Step numbers 1–2–3, stat values at 36/40 (24 on mobile) |
| `hand` | Literata italic 400 | 18/23 | 17/22 | 0 | Asides (§3.4), never rotated |

### 3.4 Handwritten asides (Nanum Pen Script)
- Maximum one aside per viewport. Each is 1–5 words, lowercase, and never carries information that
  isn't also available as real text.
- Always `aria-hidden="true"`.
- **Allowed asides:**
  - `try it: tap a dotted word` (landing hero)
  - `my pick` (only on the one recommended story card)
  - `first try` (optional, beside a first-try wrong answer)
  - `what yours could look like` (landing notebook example)
- Rotate by −3° to +3°. Never set paragraphs, buttons or labels in it.

---

## 4. Colour

### 4.1 Tokens (true black and white anchors; neutral greys only)

| Token | Light | Dark | Role | Contrast (text on its background) |
|---|---|---|---|---|
| `--paper` | `#FFFFFF` | `#000000` | Page background | — |
| `--sheet` | `#F5F5F5` | `#141414` | Raised surfaces: bottom sheet, drawer, skeleton, hover wash, code chips | — |
| `--ink` | `#000000` | `#FFFFFF` | Primary text, pen, filled buttons, borders of strong controls | 21.00 on paper; 19.26 (L) / 18.42 (D) on sheet |
| `--ink-read` | `#000000` | `#EBEBEB` | Long-form reading text (dark mode softened to cut halation) | 21.00 (L); 17.62 on paper, 15.45 on sheet (D) |
| `--ink-2` | `#404040` | `#C7C7C7` | Secondary text: subheads, card summaries, definitions' context | 10.37 / 9.51 (L); 12.42 / 10.90 (D) |
| `--ink-3` | `#595959` | `#A3A3A3` | Tertiary text: meta, captions, placeholders, locked-stamp outlines | 7.00 / 6.42 (L); 8.33 / 7.30 (D) |
| `--line-control` | `#858585` | `#7A7A7A` | **Non-text** control boundaries (inputs, choices, secondary controls, tab-bar idle icons use `--ink-3`) | 3.69 / 3.38 (L); 4.89 / 4.29 (D) — above the 3:1 non-text minimum |
| `--line-soft` | `#D9D9D9` | `#2E2E2E` | Decorative only: card edges, dividers, list rules | 1.41 (L) / 1.55 (D) — never the only boundary of a control |

Rules:
- Text only ever uses `--ink`, `--ink-read`, `--ink-2` or `--ink-3`. All pass AA (≥ 4.5:1) on both
  `--paper` and `--sheet`, in both themes.
- **Inverted surfaces** (`.inv`: closing band, lead cover, toast, filled button, active count
  badge) swap `--ink` and `--paper`. In dark mode they become white panels with black text. That is
  intentional: inversion is the emphasis device, and it stays consistent.
- **Translucency** is used only for sticky bars:
  - `color-mix(in srgb, var(--paper) 80%, transparent)` with `backdrop-filter: blur(12px)`
  - border `color-mix(in srgb, var(--ink) 8%, transparent)`
- No gradients, no tints, no near-blacks standing in for black.

### 4.2 `globals.css` (Tailwind v4, CSS-first)

```css
@import "tailwindcss";

:root {
  --paper: #FFFFFF; --sheet: #F5F5F5; --ink: #000000; --ink-read: #000000;
  --ink-2: #404040;        /* 10.37:1 paper, 9.51:1 sheet */
  --ink-3: #595959;        /* 7.00:1 paper, 6.42:1 sheet */
  --line-control: #858585; /* 3.69:1 paper (non-text) */
  --line-soft: #D9D9D9;    /* decorative only */
  --pen-w: 2px;
  --gutter: 20px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #000000; --sheet: #141414; --ink: #FFFFFF; --ink-read: #EBEBEB;
    --ink-2: #C7C7C7;        /* 12.42:1 paper, 10.90:1 sheet */
    --ink-3: #A3A3A3;        /* 8.33:1 paper, 7.30:1 sheet */
    --line-control: #7A7A7A; /* 4.89:1 paper (non-text) */
    --line-soft: #2E2E2E;
    --pen-w: 2.4px; color-scheme: dark;
  }
}
:root[data-theme="dark"] { /* same values as the block above */ }
@media (min-width: 48rem) { :root { --gutter: 32px; } }
@media (min-width: 80rem) { :root { --gutter: 40px; } }

@theme inline {
  --color-paper: var(--paper);
  --color-sheet: var(--sheet);
  --color-ink: var(--ink);
  --color-ink-read: var(--ink-read);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-line-control: var(--line-control);
  --color-line-soft: var(--line-soft);
  --font-display: var(--font-bodoni), "Bodoni 72", Didot, Georgia, serif;
  --font-read: var(--font-literata), Georgia, "Times New Roman", serif;
  --font-ui: var(--font-atkinson), system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-hand: var(--font-hand), "Bradley Hand", "Segoe Print", cursive;
}
@theme {
  --color-*: initial;            /* no Tailwind palette: hue can't sneak in */
  --spacing: 4px;                /* p-2 = 8px; use even steps only (see §6) */
  --radius-paper: 4px; --radius-control: 12px; --radius-card: 16px;
  --radius-sheet: 20px; --radius-pill: 9999px;
  --ease-pen: cubic-bezier(.6,.04,.28,1);
  --ease-out: cubic-bezier(.2,.8,.2,1);
  --ease-in: cubic-bezier(.4,0,1,1);
  --ease-thunk: cubic-bezier(.3,1.5,.5,1);
  --breakpoint-md: 48rem; --breakpoint-lg: 64rem; --breakpoint-xl: 80rem;
}
@custom-variant dark {
  @media (prefers-color-scheme: dark) { &:where(:root:not([data-theme="light"]) *) { @slot; } }
  &:where([data-theme="dark"], [data-theme="dark"] *) { @slot; }
}
/* Dark mode: white gel pen on a black sketchbook */
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .pm { filter: drop-shadow(0 0 .6px rgb(255 255 255 / .55)); } }
:root[data-theme="dark"] .pm { filter: drop-shadow(0 0 .6px rgb(255 255 255 / .55)); }

body { background: var(--paper); color: var(--ink); font: 400 17px/1.5 var(--font-ui);
       -webkit-font-smoothing: antialiased; }
::selection { background: var(--ink); color: var(--paper); }
:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.inv :focus-visible { outline-color: var(--paper); }
::highlight(wiege-listen) { background: var(--ink); color: var(--paper); }
```

The theme is stored in the local store (`prefs.theme`). Add a blocking inline script in `<head>`
of about 300 bytes. It reads `localStorage['wiege:v1']` in a try/catch and sets
`document.documentElement.dataset.theme` before first paint when the value is `light` or `dark`.
Put `suppressHydrationWarning` on `<html>`. Set `theme-color` metas to `#FFFFFF` for light and
`#000000` for dark.

### 4.3 States without hue

| State | Treatment (all of these, not one) |
|---|---|
| **Hover** (pointer) | Controls: border goes to `--ink`, background goes to `--sheet`. Links: underline thickens from 2px to 3px. Cards: `translateY(-3px)` over 150ms plus border to `--ink`. |
| **Focus** | 3px solid `--ink` outline, 3px offset (`--paper` on inverted surfaces). Whole-card links use `:has(a:focus-visible)` on the card. Never removed. |
| **Pressed** | `translateY(1px)` for 100ms. |
| **Selected / on** | Inversion: black fill, white text. Covers segmented options, pressed chips, the active app-nav link (`--sheet` wash plus `--ink` text), and the saved "Save word" button. The mobile tab bar uses `--ink` text plus a pen underline under the label. |
| **Correct / success** | 2px `--ink` border, pen ring around the answer letter, pen tick, weight 600, text label "Right answer". For saves: the button flips to filled with a tick icon and "Saved to your words". |
| **Wrong / first try** | Dashed 1.5px border, 8px hatch strip on the leading edge (`repeating-linear-gradient(135deg, var(--ink-3) 0 1.5px, transparent 1.5px 5px)`), pen cross over the letter, strike-through text in `--ink-2`, text label "Your first try", and a screen-reader suffix "Not correct." |
| **Error** (forms, system) | Field gets a 2px `--ink` border plus the hatch strip on its left inner edge. A message row sits under the field: a 20px circled "!" glyph plus text starting with what to do. It is linked with `aria-describedby`, and the field gets `aria-invalid="true"`. Page-level errors use the empty-state layout with a "Try again" action. |
| **Disabled** | Border becomes dashed 1.5px `--line-control`, text `--ink-3` (still ≥ 6.4:1), `cursor: not-allowed`, plus a tooltip or helper text explaining why. Never opacity below 1. |
| **Loading** | Skeleton blocks in `--sheet` with the exact final size. Buttons keep their width and swap the label for "Saving…" / "Checking…" with `aria-busy`. |
| **Pending / not yet** | Dashed or dotted outline in `--ink-3`: today's tally stroke, locked stamps, the dotted "just met" underline. |

---

## 5. Layout: spacing, grid, breakpoints, shape

### 5.1 Spacing (8px system)
Tokens: `4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 112 · 128` px. In Tailwind (`--spacing: 4px`)
these are `1 · 2 · 3 · 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 · 28 · 32`. Use 4 and 12 only *inside*
components (icon gaps, pill padding).
- **Proximity:** spacing inside a group is at most half the spacing between groups (8 within,
  24 or more between). Label to field: 8. Field to field: 24. Heading to its lede: 12. Lede to
  content: 40.
- **Sections:** 112px top and bottom from 1024px up; 56px on mobile. The closing band is
  80px (desktop) and 48px (mobile).
- **Gutters:** 20px under 768, 32px from 768 to 1279, 40px from 1280 up.
- **Tap targets:** every interactive element is at least 44×44 with at least 8px between targets.
  Inline links inside running text are exempt (WCAG 2.5.8 inline exception), and tap words keep
  their text-height box.

### 5.2 Containers
| Container | Max width |
|---|---|
| Page | 1440 (content 1360 at 40px gutters) |
| App pages (`/today`, `/words`, `/journal`, `/me`) | 1280 |
| Reading column | `32em` at the chosen reading size (640px at 20px; 56–70 characters per line measured) |
| Section head (heading + lede) | 760 |
| Lede | 56ch |
| Forms | 440 |
| Toast | 480 |
| Sheet on tablets | 560, centred |

### 5.3 Grids
- **Folio (the signature grid)**, used by the landing hero, "How it works", `/read/[slug]` and
  `/journal/[id]`:
  - **≥ 1280:** three columns `216px | minmax(0,1fr) | 312px`, column gap 48. The left margin
    holds the page pitch, step numbers, back link and meta. The middle holds the text. The right
    margin holds pen notes.
  - **1024–1279:** `minmax(0,1fr) | 288px`; the left-margin content becomes a row above.
  - **< 1024:** a single column. Notes move inline or into the bottom sheet (§8.7).
- **Cards:** 3 / 2 / 1 columns at ≥1024 / ≥768 / less, with a 24px gap (16px on mobile).
- **Category tiles:** 4 / 2 / 1 columns, 24px gap. On mobile, glyph on the left.
- **Stat tiles:** 4-up on desktop, 2×2 on mobile (never one column), 16px gap.
- **Container queries:** app components (Today blocks, word rows, flashcard, tab bar) respond to
  `@container app` (`container: app / inline-size` on the app shell), not the viewport. They must
  also work inside narrow panes and previews.

### 5.4 Breakpoints
`md 768px` (tablet), `lg 1024px` (folio two-column, desktop nav, margin notes), `xl 1280px` (full
three-column folio). Design and QA at **360, 390, 768, 1024, 1366×768 (Chromebook), 1440**.

### 5.5 Radii (meaning, not decoration)
| Token | Value | Used for |
|---|---|---|
| `paper` | 4px | Things that are pages or print: story cards, covers, category tiles, thumbnails, panels, continue-reading rows |
| `control` | 12px | Things you type into or pick: inputs, quiz choices, grade buttons, the writing editor |
| `card` | 16px | The flashcard (an index card) |
| `sheet` | 20px | Top corners of the bottom sheet |
| `pill` | 9999px | Things you press: buttons, chips, segmented controls, tags, count badges, icon buttons |

### 5.6 Borders
| Weight | Use |
|---|---|
| 1px `--line-soft` | Decorative: card edges, dividers, list rules |
| 1.5px | `--line-control` for inputs, choices and segmented controls; `--ink` for secondary buttons and the flashcard |
| 2px `--ink` | Selected or correct: right answer, "Good" grade, active field, error field |
| 3px outline | Focus only |
| 1.5px `--ink` spine | The notebook spread on `/me` and the landing |

### 5.7 Elevation
No box-shadows anywhere. Layers separate by:
- translucent paper plus blur plus an 8% hairline (sticky nav, tab bar, mobile CTA bar)
- a 1.5px `--ink` edge (sheet, drawer, popover, flashcard)
- inversion (toast)

The only filter in the system is the dark-mode gel sheen on pen marks.

### 5.8 Z-index
| Layer | z |
|---|---|
| Base | 0 |
| Raised in-flow (card hover) | 1 |
| Sticky in content (reader toolbar) | 10 |
| Nav / tab bar | 40 |
| Mobile CTA bar | 45 |
| Bottom sheet | 50 |
| Drawer + scrim | 60 |
| Popover / "Define" bubble | 70 |
| Toast | 80 |
| Skip link | 100 |

---

## 6. Motion

Import from `motion/react`, using `LazyMotion` with `domAnimation` and `m`. Use it only for:
- the bottom sheet and drawer (enter/exit with `AnimatePresence`)
- the flashcard flip
- the toast

Pen drawing uses the Web Animations API in a tiny client hook (§8.5), not `motion`.

| Token | Duration | Easing | Used for |
|---|---|---|---|
| press | 100ms | linear | `translateY(1px)` |
| quick | 160ms | `ease-out` | Hover colour, note fade-in |
| base | 200ms | `ease-out` | Nav 64→56px on scroll, sticky CTA bar slide-up, tab underline |
| thunk | 240ms | `ease-thunk` | Stamp seal earned (scale 1.12→1, rotate −4°→−2°) |
| sheet | 280ms | `ease-out` in / `ease-in` 200ms out | Bottom sheet and drawer |
| flip | 360ms | `ease-out` | Flashcard `rotateY` 0→180° (with `backface-visibility: hidden`) |
| pen-short | 260ms | `ease-pen` | Tick, box tick, underline, caret, tally stroke |
| pen | 420ms | `ease-pen` | Loop, squiggle, double underline, seal ring |
| arrow | 320ms after a 380ms delay, head 140ms | `ease-pen` | Margin-note leader |
| count | 160ms | `ease-out` | Count badge tick (old number slides up 8px out, new one in) |

- **The one orchestrated moment per page.** On the landing page (desktop only), 500ms after fonts
  are ready, the pen circles `rehearse`, the arrow runs into the margin, and the note fades in.
  App pages have none. Their motion only answers actions.
- **What animates:** only responses to the user (tap, save, answer, flip, practise, earn) and
  sticky chrome. Nothing fades or slides in on scroll. Reading text, headlines, cards and
  sections never animate on load.
- **Response time:** every tap shows its response within 100ms (the loop starts drawing on
  `pointerdown`). Saves are optimistic: counters update immediately and roll back with a toast if
  storage fails. Keep UI responses under 400ms.
- **`prefers-reduced-motion: reduce`:**
  - pen marks render in their final state
  - the flip becomes an instant swap with a 0ms cross-fade
  - the sheet and drawer appear without sliding
  - the count badge swaps without movement
  - no smooth scrolling
  - the countdown text still updates

  Implement it with a global `@media (prefers-reduced-motion: reduce)` that zeroes transitions,
  plus `useReducedMotion()` for motion components.

---

## 7. Icons
- **UI icons:** `lucide-react` (installed) at 20px, `strokeWidth={1.8}`, round caps and joins.
  Use: `Clock`, `Volume2` (say / listen), `Plus`, `Check`, `X`, `ChevronLeft`, `Search`, `Menu`,
  `Type` (reading settings), `Lock`, `EyeOff`, `Smartphone`, `CalendarDays` (Today),
  `LayoutGrid` (Explore), `NotebookText` (Words), `BookOpen` (Journal), `User` (Me),
  `Download`, `Upload`, `Trash2`.
- **Not allowed:** arrow-right icons appended to links, and filled icon variants.
- **Category glyphs** are custom, hand-drawn and SVG (§9). They are the only illustrated icons.

---

## 8. The signature: the pen

### 8.1 What it is
One primitive, `<PenMark>`: an inline SVG stroke that looks drawn by a gel pen, seeded so it is
identical on every render, and server-rendered in its final state. The client only *animates*
marks created by a user action.

Kinds:

| Kind | What it means | ViewBox | `preserveAspectRatio` |
|---|---|---|---|
| `loop` | "This word." (tapped word, mastery level 5 "Know it cold") | `0 0 W 100`, where `W = 100 × aspect` | `none` |
| `ring` | Open ellipse around something round: the answer letter | `0 0 100 100` | `none` |
| `squiggle` | Mastery 2 "Seen it"; a word you've met before, in running text | `0 0 100 10` | `none` |
| `underline` | Mastery 3 "Getting there"; cover mark | `0 0 100 10` | `none` |
| `double` | Mastery 4 "Nearly"; a strong phrase in your writing | `0 0 100 14` | `none` |
| `tick` | Correct; used a vocabulary word; step done | `0 0 30 26` | `xMidYMid meet` |
| `cross` | First-try wrong answer (over the letter) | `0 0 40 40` | `xMidYMid meet` |
| `caret` | "Add something here" in writing feedback | `0 0 14 12` | `xMidYMid meet` |
| `box` | Empty meter box (then `tick` inside when a word is kept) | `0 0 22 22` | `xMidYMid meet` |
| `tally` | Reading days in groups of five; today's pending stroke is dashed | measured `0 0 W 72` | `xMinYMid meet` |
| `seal` | Stamp: outer loop ring plus inner disc (filled when earned) | `0 0 120 120` | `xMidYMid meet` |
| `bracket` | Left edge of a margin note (three pieces: top hook, stretch, bottom hook) | pieces | mid piece `none` |
| `leader` | Arrow from the note to the word's line (desktop only, measured) | overlay SVG | — |
| `progress` | A pen line over a dotted track (quiz, flashcards, continue reading) | `0 0 100 12` | `none` |

Every mark sets these on its SVG:
- `class="pm pm--{kind}"`, `aria-hidden="true"` and `focusable="false"`
- stroke `currentColor` with `fill: none`, round caps and joins, and `vector-effect: non-scaling-stroke`
- stroke width `calc(var(--pen-w) * var(--pen-scale, 1))`

`--pen-scale` by context:

| Context | `--pen-scale` | Stroke |
|---|---|---|
| Reading text | 1.05 | ≈ 2.1px |
| Covers | 1.6 | ≈ 3.2px |
| Hero headline | 1.75 | ≈ 3.5px |
| Tally | 1.4 | ≈ 2.8px |
| Seals | 1.1 | ≈ 2.2px |

Rule of thumb: stroke is about 4.5% of font size, clamped to 2–4px.

### 8.2 Determinism (SSR-safe)

`src/components/ink/pen.ts` is isomorphic: no DOM, no `server-only`.

```ts
export const fnv1a = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const r1 = (n: number) => Math.round(n * 10) / 10; // 0.1 precision: identical strings server/client
export function smooth(pts: Array<[number, number]>): string {
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    d += `Q${r1(x)} ${r1(y)} ${r1((x + nx) / 2)} ${r1((y + ny) / 2)}`;
  }
  const l = pts[pts.length - 1];
  return `${d}L${r1(l[0])} ${r1(l[1])}`;
}
export const penSeed = (kind: string, text: string, scope = '') => fnv1a(`${kind}:${text.toLowerCase()}:${scope}`);
```

- **Seed:** `penSeed(kind, word, storySlug)`. The same word in the same story always gets the same
  mark; the same word in another story gets a sibling mark.
- Generate paths **once**, in the Server Component, and pass the `d` strings down. Client code
  calls the same functions only for marks the user creates. There is no second render that could
  disagree, so there is no hydration mismatch.

### 8.3 Geometry (reference implementations from the mockup)

```ts
// Word loop: a hand-drawn rounded rectangle in an aspect-aware box. Straight runs hug the word;
// corners stay tight; the spiral overshoot (tail) finishes above the word, outside the start.
export function loopPath(seed: number, aspect = 3) {
  const r = mulberry32(seed), H = 100, W = Math.max(110, Math.round(100 * aspect)), m = 4;
  const A = W / 2 - m, B = H / 2 - m, rad = Math.min(B * (0.74 + r() * 0.12), A * 0.5);
  const sx = A - rad, sy = B - rad, q = (Math.PI * rad) / 2, cx = W / 2, cy = H / 2;
  const segs = [2 * sx, q, 2 * sy, q, 2 * sx, q, 2 * sy, q], P = segs.reduce((a, b) => a + b, 0);
  const at = (s: number): [number, number, number, number, number] => {
    s = ((s % P) + P) % P; let i = 0; while (s > segs[i]) { s -= segs[i]; i++; }
    const u = segs[i] ? s / segs[i] : 0;
    switch (i) {
      case 0: return [cx - sx + 2 * sx * u, cy - B, 0, -1, u];
      case 2: return [cx + A, cy - sy + 2 * sy * u, 1, 0, u];
      case 4: return [cx + sx - 2 * sx * u, cy + B, 0, 1, u];
      case 6: return [cx - A, cy + sy - 2 * sy * u, -1, 0, u];
      default: {
        const k = (i - 1) / 2, a = -Math.PI / 2 + k * (Math.PI / 2) + u * (Math.PI / 2);
        const ox = [cx + sx, cx + sx, cx - sx, cx - sx][k], oy = [cy - sy, cy + sy, cy + sy, cy - sy][k];
        return [ox + rad * Math.cos(a), oy + rad * Math.sin(a), Math.cos(a), Math.sin(a), -1];
      }
    }
  };
  const s0 = sx * (1.45 + r() * 0.3), sweep = P * (1.07 + r() * 0.03), ph = r() * 6, bow = 2 + r() * 1.5;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 96; i++) {
    const t = i / 96, [x, y, nx, ny, u] = at(s0 + sweep * t);
    const off = (u >= 0 ? bow * Math.sin(Math.PI * u) : 0) + 1.2 * Math.sin(t * 9 + ph) + t * 5;
    pts.push([x + nx * off, y + ny * off]);
  }
  return { viewBox: `0 0 ${W} ${H}`, d: [smooth(pts)] };
}

export function ringPath(seed: number) { // open ellipse for letters and numbers
  const r = mulberry32(seed), start = -Math.PI * (0.3 + r() * 0.08), sweep = Math.PI * 2 * (1.06 + r() * 0.03), ph = r() * 6;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 52; i++) {
    const t = i / 52, a = start + sweep * t, k = 1 + 0.028 * Math.sin(a * 2 + ph) + (t - 0.5) * 0.06;
    pts.push([50 + 46 * k * Math.cos(a), 50 + 44 * k * Math.sin(a)]);
  }
  return { viewBox: '0 0 100 100', d: [smooth(pts)] };
}

export function squigglePath(seed: number, chars: number) {
  const r = mulberry32(seed), waves = Math.max(3, Math.min(16, Math.round(chars * 0.9))), w = 100 / waves;
  let d = 'M0 5', x = 0, up = true;
  for (let i = 0; i < waves; i++) {
    const nx = Math.min(100, x + w);
    d += `Q${r1(x + w / 2)} ${r1(5 + (up ? -3.6 : 3.6) * (0.8 + r() * 0.4))} ${r1(nx)} ${r1(5 + (r() - 0.5))}`;
    x = nx; up = !up;
  }
  return { viewBox: '0 0 100 10', d: [d] };
}
export const underlinePath = (seed: number) => { const r = mulberry32(seed);
  return { viewBox: '0 0 100 10', d: [`M${r1(1 + r() * 2)} ${r1(4 + r() * 2)}Q50 ${r1(6 + r() * 2.5)} ${r1(97 + r() * 2)} ${r1(3 + r() * 2)}`] }; };
export const doublePath = (seed: number) => { const r = mulberry32(seed);
  return { viewBox: '0 0 100 14', d: [
    `M${r1(1 + r() * 2)} ${r1(3 + r())}Q50 ${r1(5 + r() * 2)} 98 ${r1(2.5 + r())}`,
    `M${r1(6 + r() * 4)} ${r1(10 + r())}Q52 ${r1(12 + r() * 1.5)} ${r1(92 + r() * 4)} ${r1(9.5 + r())}`] }; };
export const TICK = 'M2.5 14.5C5.8 16.4 8.6 19.6 10.8 23.6 15.6 13.2 21.8 6.2 28 2.2';   // viewBox 0 0 30 26
export const CARET = 'M1.5 11L7 1.8L12.5 11';                                           // viewBox 0 0 14 12
export const crossPath = (seed: number) => { const r = mulberry32(seed), j = () => (r() - 0.5) * 3;
  return { viewBox: '0 0 40 40', d: [`M${r1(9 + j())} ${r1(9 + j())}C18 18 24 25 ${r1(31 + j())} ${r1(32 + j())}`,
                                     `M${r1(31 + j())} ${r1(8 + j())}C23 16 17 24 ${r1(9 + j())} ${r1(32 + j())}`] }; };
```

The mockup also contains the reference code for these, which should be ported the same way:
- `tally(n)`: strokes 14px apart, groups of four plus a diagonal slash, 30px between groups, and
  today's stroke dashed `2 6` in `--ink-3`
- `seal(id)`: an outer ring (`ringPath` with rx 56, ry 55) plus an inner disc (rx 45, ry 44)
- `box(seed)`
- the three-piece `bracket`
- the `leader` arrow

**Aspect for loops on the server:**
- `aspect = (chars × adv + 2 × lx) / (lineBox + lt + lb)`
- `adv` (em per character): Literata 400 = 0.50, Bodoni 700 = 0.58, Bodoni 900 = 0.62
- The client may refine the aspect from the measured box after mount. The SVG is absolutely
  positioned, so this never shifts layout.

### 8.4 Placement (CSS)
Tap words are `inline-block` with `line-height: 1.2` in reading text and inherited line height in
display text. Marks are positioned against that box:

```css
.pm { position: absolute; pointer-events: none; overflow: visible; }
.pm--loop { left: calc(var(--lx, .17em) * -1); top: calc(var(--lt, .06em) * -1);
            width: calc(100% + var(--lx, .17em) * 2); height: calc(100% + var(--lt, .06em) + var(--lb, .04em)); }
.pm--squiggle  { left: 0; width: 100%; bottom: -.34em; height: .3em; }
.pm--underline { left: -.04em; width: calc(100% + .08em); bottom: -.3em; height: .3em; }
.pm--double    { left: -.04em; width: calc(100% + .08em); bottom: -.46em; height: .42em; }
.pm--ring  { inset: -6px; width: calc(100% + 12px); height: calc(100% + 12px); }
.pm--cross { inset: -4px; width: calc(100% + 8px);  height: calc(100% + 8px); }
/* context insets: loops must stay inside the word space (≈ .25em) sideways */
.read .tap, .draft .mk { --lt: .2em; --lb: .14em; --lx: .11em; }  /* uses the 1.72 line gap */
.display-xl .tap       { --lt: .06em; --lb: .04em; --lx: .14em; }
.word-list .w          { --lt: .06em; --lb: .04em; --lx: .15em; }
```

### 8.5 Drawing in (client only)
Under `vector-effect: non-scaling-stroke`, dashes are measured in *screen* space (verified in Chrome).
So `pathLength="1"` is wrong here. Measure instead:

```ts
// src/components/ink/use-pen-draw.ts  ('use client')
export function drawIn(svg: SVGSVGElement, { delay = 0, duration = 420 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  const sx = vb.width ? box.width / vb.width : 1, sy = vb.height ? box.height / vb.height : 1;
  svg.querySelectorAll('path').forEach((p, i) => {
    const L = p.getTotalLength(); let prev: [number, number] | null = null, len = 0;
    for (let k = 0; k <= 80; k++) { const pt = p.getPointAtLength((L * k) / 80), q: [number, number] = [pt.x * sx, pt.y * sy];
      if (prev) len += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
    len += 2; p.style.strokeDasharray = `${len} ${len}`;
    p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration, delay: delay + i * duration * 0.6, easing: 'cubic-bezier(.6,.04,.28,1)', fill: 'backwards' });
  });
}
```

Recompute leader arrows and margin-note positions on `document.fonts.ready`, on a `ResizeObserver`
on the folio, and on level or font-size change. Debounce by 120ms.

### 8.6 Tap words
- Vocabulary words (5–8 per story) and multi-word idioms ("shave off", "by heart", "frame by frame")
  are `<button type="button" class="tap">`. Each has:
  - `aria-expanded`
  - `aria-controls` pointing at the note or sheet id
  - `aria-label="{word}: show what it means"`
  - an extra ", you have met this word before" when mastery is 2 or more
- **Idle:** dotted underline, `text-decoration-thickness: clamp(2px, .07em, 4px)`,
  offset `.2em`. **Hover:** the underline goes solid. **Open:** the underline is hidden and the
  `loop` is drawn. **Already in your words:** the word's mastery mark replaces the dotted
  underline (§8.8).
- **Punctuation:** the server tokenizer wraps a tap word *and its trailing punctuation* in
  `<span class="nobr">` (`white-space: nowrap`), so a comma can never start a line.
- Any other word is tappable through `caretPositionFromPoint` (SPEC §8). It gets the same loop,
  drawn in an absolutely positioned overlay using the range's client rect.
- `scroll-margin-top: 88px; scroll-margin-bottom: 45svh` so a tapped word is never hidden under
  the nav or the sheet.

### 8.7 The margin note (`<MarginNote>`)

**Anatomy, top to bottom** (UI font unless stated):
1. Headword (`note-word`, Bodoni 800 34) plus part of speech (Literata italic 17, `--ink-3`).
2. Say-it line (Literata italic 17, `--ink-2`), for example `Say it: ri-HURSS. Rhymes with verse.`
   The stressed syllable is bold caps, upright. This line works where `speechSynthesis` doesn't.
3. Definition (17/26, kid-friendly, one or two sentences).
4. **In this story.** How the word is used here (15/22, `--ink-2`, bold lead-in). Reader only.
5. Example sentence (Literata italic 17/26, `--ink-2`). This is new text, not a copy of the story.
6. Literacy extra (15/22, `--ink-3`, bold lead-in in `--ink`). One of: **Word root.**, **Word
   history.**, **Word family.**, **Figure of speech.**, **Idiom.**, **Context clue.**,
   **Oxymoron.** (with more examples), **Another meaning.**
7. Actions, in this order:
   - `Save word`: a secondary pill, 40px tall, with a 44px hit area. When pressed it becomes
     filled, with a tick and the label "Saved to your words".
   - A 44px circular speaker button labelled "Say {word} out loud". Hide it when
     `speechSynthesis` is missing.

The bracket runs down the left edge (26px left padding). The note container is
`role="region" aria-label="Word note" aria-live="polite"`.

**Placement:**

| Where | ≥ 1024px | < 1024px |
|---|---|---|
| Landing hero, landing "How it works" | **margin**: absolutely placed in the right folio column, top = word top − 4px; the column grows (`min-height`) to fit; leader arrow from the note's top-left to the end of the word's line | **inline**: inserted directly after the block (headline or paragraph) containing the word, 24px above and below; no arrow |
| `/read/[slug]` | **margin** (as above) | **sheet**: a non-modal bottom sheet (§11.9); the reader gets bottom padding equal to the sheet height; the tapped word scrolls to the top 40% of the visible area |
| Writing feedback | **margin**, aligned to the first marked line | **inline**: a list under the editor |

Only one note is open at a time. Opening another word replaces the note in place, with a 160ms
fade. Esc closes it and returns focus to the word.

### 8.8 Mastery = the pen mark (maps 1:1 to SPEC's Leitner boxes)

| Box | Mark on the word (reader, word list, flashcard) | Label | Next practice |
|---|---|---|---|
| 1 | dotted underline | Just met | today |
| 2 | `squiggle` | Seen it | tomorrow |
| 3 | `underline` | Getting there | in 3 days |
| 4 | `double` | Nearly | in a week |
| 5 | `loop` | Know it cold | in 16 days |

- Grading a flashcard "Good" or "Easy" redraws the new mark with the pen animation. That is the
  reward.
- "Again" returns the word to the dotted underline, with no animation and no negative message.
- In stories, words you already own show their mark. Reading teaches you what you know.

### 8.9 Story art: the key-word cover (`<StoryArt>`)

The deterministic generative art SPEC asks for, with no third-party images:

- **Surface:** 16:9 (Today's pick is 16:8), `--paper` with a 1px `--line-soft` border. The one
  highlighted card (the lead card of a list, or Today's pick) is inverted.
- **The word:** the story's key vocabulary word (≤ 12 letters; if none qualifies, use the category
  glyph at 96px instead). Bodoni 900, bottom-left, 22px padding, line height 0.9, tracking −0.025em.
- **Fit, never crop:**
  - Build step `scripts/dev/bodoni-advances.mjs` uses the installed Playwright and Chrome with
    canvas `measureText` at 1000px, weight 900. It writes
    `src/components/ink/bodoni-advances.json` (advance per character, in em).
  - The server computes `em = Σ advances − (n − 1) × 0.025` and sets `style={{'--em': em}}`.
  - CSS: `font-size: min(calc((100cqw - 48px) / var(--em)), 136px)` with
    `container-type: inline-size` on the cover.
  - The word fills the width at every card size, and no letter is ever cut.
- **The mark:** one pen mark on the word, chosen by `fnv1a(slug) % 4` from `underline`, `double`,
  `squiggle` and `loop`, with `--pen-scale: 1.6`.
- **Glyph:** the category glyph at 30px, top-left (20px, 18px), stroke 1.7.
- **Aside:** the `my pick` hand aside, top-right, rotated −3°. Only on the recommended story.
- `aria-hidden="true"`. The card's title carries the meaning.

---

## 9. Category glyphs

The glyphs are hand-drawn: slightly irregular strokes, no fills except button dots, and a
48×48 viewBox. Render them with `fill="none" stroke="currentColor" stroke-linecap="round"
stroke-linejoin="round"` and `vector-effect: non-scaling-stroke` on every child. Stroke widths:
- 2.4 at 72px (desktop tiles)
- 2.2 at 56px (mobile tiles)
- 1.8 at 26–34px (list heads, thumbnails)
- 1.7 at 22–30px (meta, covers)

On hover of a category tile, the glyph does not animate; the tile lifts. Keys match
`src/lib/categories.ts`.

**Writing: `quill`.** A feather quill slanting up to the right, a shaft ending in a nib, three barb
notches, and an ink flick under the nib.
```svg
<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <path d="M41.6 5.2C30.4 7.6 20.2 15.6 14.4 27.6c-1.6 3.4-2.6 6.6-3 9.4 3-1.2 6.4-2.8 9.6-5.2 9.4-7 16.2-16.2 20.6-26.6Z"/>
  <path d="M8.2 42.6 30.6 16"/>
  <path d="M16.6 29.2l6.2.2M20.4 23.4l6.4-.4M24.6 17.8l5.8-.8"/>
  <path d="M5 44.4c3.4-.8 7.2 1 10.8-.2"/>
</svg>
```

**Games: `controller`.** A game controller with rounded grips, a d-pad and two face buttons.
```svg
<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15.2 15.4c-6.2.2-9.4 7.2-10 14-.4 5.4 3 8.2 6.8 6.2l5.4-4.6h13.4l5.6 4.8c3.8 2 7.2-.8 6.8-6.2-.6-6.8-3.8-14-10-14.2-5.4-.2-12.4-.2-18 0Z"/>
  <path d="M14.6 20.8l.2 7.6M10.8 24.6l7.6.2"/>
  <circle cx="31.4" cy="21.6" r="1.9"/>
  <circle cx="35.8" cy="26.2" r="1.9"/>
</svg>
```

**Art: `brush`.** A paintbrush on the diagonal (handle, ferrule, loaded tuft) above a painted
stroke.
```svg
<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <path d="M38.2 4.8c2.2-.6 5.4 2.6 4.8 4.8L28.4 24.4l-4.8-4.8Z"/>
  <path d="M23.6 19.6l4.8 4.8-3 3-4.8-4.8Z"/>
  <path d="M20.6 22.6l4.8 4.8c-2.2 5.4-7.6 9.4-15.2 10.8 1.2-6.8 5-12.8 10.4-15.6Z"/>
  <path d="M6.4 44c6-2.6 13.4 1.6 21.6-1.4 3-1.1 5.8-1.2 8.4-.4"/>
</svg>
```

**Sports: `ball`.** A basketball-style ball with wobbly seams. It reads as "sport" at 22px.
```svg
<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <path d="M24.2 6.6c9.8-.2 17.4 7.6 17.2 17.6-.2 9.8-8 17.4-17.6 17.2C14 41.2 6.4 33.6 6.6 23.8 6.8 14 14.4 6.8 24.2 6.6Z"/>
  <path d="M7.2 23.2c11.4 1.4 22.4 1.2 34 .2"/>
  <path d="M24.6 7c-1.2 11.4-1 22.8-.4 34.2"/>
  <path d="M12.4 11.8c5.8 6.6 6.4 18.6-.4 25.2"/>
  <path d="M35.8 11.4c-6.4 6.8-6.6 18.8.4 25.8"/>
</svg>
```

Ship them as `src/components/ink/CategoryGlyph.tsx`, with
`({ glyph, size, strokeWidth, title? })`. They are `aria-hidden` unless a `title` is passed.

**Wordmark.** "Wiege" is set in Bodoni 900 (30px in the nav, 26px in the app bar). Under it sits a
fixed curved stroke: a cradle rocker, which is the meaning of the name.
`<svg viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M1.5 2.2C20 10.6 76 10.8 98.5 1.4"/></svg>`,
stroke 2.2, non-scaling. It is part of the logo, not a pen mark, and it never animates. Favicon and
app icon: a black 512 square with a white Bodoni "W" and the rocker.

---

## 10. Voice and copy

**Who's talking:** a sharp older student who likes words. Warm, direct and never babyish.

- Sentence case. Plain verbs. Speak to the student in the second person. Short sentences.
- Buttons say exactly what happens: "Start reading", "Save word", "Practise 5 words", "Get
  notes on my writing", "Save a backup file". The same action keeps the same name through the
  whole flow: "Save word" leads to "Saved to your words", and "Remove" leads to "Removed".
- Numbers are specific and true: "5 words are ready", "Updated 2 hours ago", "Next drop in
  1 h 52 min". Never "lots", never invented totals.
- Errors say what happened and what to do next. They never apologise, never blame, never say
  "Oops".
- Empty states say what will live here, show an example and give exactly one action.
- **No guilt, no fake urgency, no confirmshaming.** Streaks end kindly. The countdown is the real
  ingest schedule.
- **Banned:**
  - ALL CAPS and tracked eyebrow labels
  - "WORD — fragment" labels; middle-dot meta strings (use icon-separated items)
  - "→" appended to links; emoji; exclamation marks in UI chrome
  - "Click here"
  - "Awesome!", "Great job!!", "Uh-oh"
  - any mention of accounts, logging in or signing up (SPEC §13), except "No sign-up" as a promise

| Moment | Copy |
|---|---|
| Landing pitch (`h1`) | Real news from the last four hours, turned into reading practice for ages 12 to 15. |
| Landing sub | Writing, games, art and sport. Tap any word you don't know, answer a question, write back. |
| Primary CTA + micro-copy | Start reading · *Free. No sign-up. Your progress stays on this device.* (two separate elements, not a dot-joined string) |
| Hero aside | try it: tap a dotted word |
| Meter | 0 of 3 words kept → 1 of 3 words kept → All 3 kept. They're in your words. |
| Freshness | Updated at 12:00. Next drop in 1 h 52 min. / Updated 2 hours ago. |
| Save word / toast | Save word → Saved to your words. Toast on remove: Removed "stamina". [Undo] |
| Quiz, wrong | Label: Your first try. Note: Not quite. Look at what Priya says right after "narrative". |
| Quiz, right | Got it. / Got it on the second try. Secondary action: Show me where it says so |
| Quiz summary | 4 of 5 on your first try. +25 XP. |
| Feedback waiting (real steps) | Counting sentences → Checking your vocabulary words → Reading for ideas → Writing notes |
| Feedback notes | Working: Great verb: "rewinds" shows her doing something, fast. / Try next: Give her a name. Readers care faster about someone they can call by name. |
| AI disclosure (next to the button) | Wiege sends only your writing and the prompt to write these notes. Nothing is stored. |
| Streak, returning after a gap | Welcome back. Start a new line today. |
| Streak, today pending | Read one story today to make it 13. |
| Stamp earned (toast) | New stamp: 7 days in a row. |
| Stamp locked | Next: read one story from each category. |
| Level | Storyteller. 140 XP to Wordsmith. |
| Empty words | Your words will live here. Tap any dotted word in a story, then Save word. [Read today's story] |
| Empty journal | Your writing stays here, on this device. Every story ends with a short prompt. [Write about today's story] |
| Empty "Continue reading" | (hidden; Today's story moves up) |
| Nothing due | Nothing to practise right now. Your next word is due tomorrow. |
| Storage unavailable | Progress can't be saved in this browser mode. Open Wiege in a normal window to keep your words. |
| Offline | You're offline. Stories you've already opened still work. |
| 404 | This page has moved on. [See today's stories] |
| Story removed | This story has moved on. News stays on Wiege for 120 days. [See today's stories] |
| Error | This page didn't load. Check your connection, then try again. [Try again] |
| Clear data confirm | Type **clear** to delete every word, entry and stamp on this device. This can't be undone. [Clear everything] |
| Backup | Save a backup file · Restore from a backup · Restored 23 words, 4 entries and 3 stamps. |

---

## 11. Components

Each component below lists its anatomy, sizes and states. All interactive components meet 44×44,
show the focus ring, and have an accessible name.

### 11.1 Button
| Variant | Style | Use |
|---|---|---|
| **Primary** | Pill, `--ink` fill, `--paper` text, Atkinson 700 17px, 48px tall, 24px horizontal padding. Hover `--ink-2` fill. | One per viewport: the next best step |
| **Secondary** | Pill, 1.5px `--ink` border, transparent. Hover `--sheet`. | Alternatives: "Read this story", "Save word" |
| **Ghost / link** | Atkinson 700, underline 2px at 5px offset, 44px hit area (`inline-flex`, `min-height: 44px`). Hover underline 3px. | Tertiary: "See all", "Show me where it says so" |
| **Icon** | 44px circle, 1.5px `--line-control` border, 20px icon. Hover border `--ink` + `--sheet`. | Say it, listen, reading settings, close, search, menu |

- **Sizes:** L 48px (default), S 40px with 16px text (nav and notes; keep a 44px hit area with
  vertical padding), block (full width on mobile sheets and bars).
- **States:** hover, focus (3px ring), pressed (1px down), loading (label → "Saving…", width
  locked, `aria-busy`), disabled (§4.3).
- On inverted surfaces, the primary button is `--paper` fill with `--ink` text.
- The landing nav CTA is **secondary while the hero CTA is on screen**, then fills (200ms). That
  way there is never more than one filled action in view.

### 11.2 Text input
- 48–52px tall, 1.5px `--line-control` border, 12px radius, 16px padding, Atkinson 18px (never
  under 16 on mobile).
- Label above, 15px 700, 8px gap. Helper text below, 14px `--ink-3`.
- Placeholder text uses `--ink-3` and never replaces the label.
- **Focus:** border `--ink` plus the ring. **Error:** §4.3.
- **Search variant:** 20px search icon inside on the left; `type="search"`; Esc clears.

### 11.3 Password input with show toggle
Same as the text input, with a 44px text button inside on the right: "Show" or "Hide",
`aria-pressed`, `aria-controls` pointing at the field. It toggles `type` and keeps focus in the
field. Only used if accounts ever ship (§12.11).

### 11.4 Select and segmented control
- **Segmented** (2–4 options: grade band, sort, theme, font, size, spacing):
  - pill container, 1.5px `--line-control` border, 3px inner padding
  - options 40px tall with 16px padding, Atkinson 700 15px
  - the selected option is filled
  - built as `<fieldset>` + visually hidden `<legend>` + radio inputs; arrow keys move
- **Select** (more than 4 options, rare): native `<select>` styled like the text input with a
  chevron. Never a custom listbox.

### 11.5 Chip
- 36–40px pill, 1.5px `--line-control` border, Atkinson 600 15px.
- **Vocabulary chip** in the editor: when the word is used in the draft, the border goes to `--ink`,
  the weight to 800 and a pen tick is drawn (the tick animates once).
- **Filter chip:** selected is filled and uses `aria-pressed`.
- **Tag** ("Practice story"): 28px pill, 1.5px `--ink` border, 14px 700. Not interactive.

### 11.6 Story card (whole card is one link)

| Size | Anatomy | Where |
|---|---|---|
| **S** (row) | 64×64 thumbnail (4px radius, category glyph 34px; ink for the first row), title (Bodoni 700 20/24, ≤ 3 lines), meta line (14px 600: progress text + pen `progress` line 120px). Min height 88, 16px padding, 1px `--line-soft` border. | Continue reading, search results, mobile lists |
| **M** (grid) | Cover (§8.9, 16:9), meta row (glyph + category, clock + minutes), title (`h4`), summary (Literata 17/26, 2 lines, `--ink-2`). 16px gaps. | Landing "Fresh", `/c/[category]` |
| **L** (pick) | 1.5px `--ink` border, cover 16:8 (inverted), body 24px padding: "why" line (15px `--ink-2`), title, meta ("4 min read", "4 new words"), one secondary button. | Today's story |

- **States:**
  - hover: lift 3px over 150ms with the border to `--ink`; on touch the affordance is visible
    by default
  - focus: the ring on the card
  - done: a pen tick plus "Read" (13px 700 `--ink-3`) after the title
- Title links use `a::after { inset: 0 }` to cover the card.
- **List caps:** cap mobile lists at 6 cards, followed by a "See all" link.

### 11.7 Category tile
- **Anatomy:** glyph (72px desktop, 56px mobile), name (Bodoni 800 38/28), description (16px
  `--ink-2`), "**9** new today" (the number in Atkinson 800 20px), then a rule and **Latest** (14px
  700 `--ink-3`) with the newest headline (Literata 16/23).
- **Layout:** 1px `--line-soft` border, 4px radius, padding 28/24/24, min height 340 on desktop. On
  mobile the glyph sits on the left (56px column + 16px gap), padding 20.
- **States:** hover lifts 3px and the border goes to `--ink`; focus ring.
- A count of 0 reads "Nothing new yet today"; the tile stays.

### 11.8 Nav bar, mobile tab bar, drawer
- **Landing / info nav (sticky):**
  - 64px tall (56px after 8px of scroll, 200ms), paper at 80% with a 12px blur and an 8% hairline
  - wordmark on the left
  - up to 3 text links: "Today's stories", "How it works", "For parents and teachers"
  - the **Words count** link ("Words" + a 28px ink pill with the number, Atkinson 800 15px,
    `aria-label="Your words: N saved"`)
  - one CTA button (§11.1)
- **< 1024:** 56px bar with the wordmark, the CTA (40px) and a 44px menu button.
- **App nav (≥ 768, app pages):**
  - wordmark, then links Today · Explore · Words (count pill) · Journal · Me (pills 44px tall;
    the current one gets a `--sheet` wash with `--ink` text and `aria-current="page"`)
  - search icon button on the right
  - no filled button in the app nav
- **Mobile tab bar (app pages < 768):**
  - 56px + `env(safe-area-inset-bottom)`, five equal tabs
  - each tab: 22px icon over a 12px 700 label; idle `--ink-3`, current `--ink` with a 28px pen
    underline under the label (drawn once on change)
  - Words shows a due-count badge (18px ink pill, 12px 800)
  - paper at 94% with a 12px blur and a 10% hairline on top
  - pages get `padding-bottom: calc(56px + env(safe-area-inset-bottom) + 24px)`
  - in `/read/*` the tab bar hides while scrolling down and returns on scroll up and at the end
  - never shown at 768 and up
- **Drawer** (landing menu < 1024):
  - slides in from the right, 280ms
  - full height, width `min(360px, 88vw)`, `--paper` with a 1.5px `--ink` left edge
  - 48px rows (Atkinson 700 18), the Words count row, then the CTA as a block button at the bottom
  - scrim `color-mix(in srgb, var(--ink) 40%, transparent)`
  - focus trapped, Esc and scrim close it, focus returns to the menu button
  - `role="dialog" aria-modal="true"`
- **Sticky mobile CTA bar (landing < 768):**
  - `visibility: hidden` plus translated off-screen until the hero CTA has scrolled above the
    viewport (IntersectionObserver), then slides up in 200ms
  - one 48px block button, paper at 95% with an 8px blur
  - the page gets matching bottom padding; hidden at 768 and up

### 11.9 Popover and margin note; bottom sheet
- **Margin note:** §8.7.
- **"Define" popover** (desktop, after selecting text):
  - a 40px pill button "Define" above the selection end, `--ink` fill
  - Enter opens the note for the selected word
  - z 70; dismissed on selection change
- **Bottom sheet** (mobile note, reading settings, restore preview):
  - `--paper`, 1.5px `--ink` top edge, 20px top radius, 40×4 grab handle in `--line-control`
  - 20px padding plus the safe area; max height 50svh with internal scroll; 44px close button at
    top-right
  - **non-modal for word notes:** no scrim, the page stays scrollable and tappable, tapping
    another word swaps the content, and the tapped word stays visible above the sheet
  - modal (scrim, focus trap) only for settings and destructive confirmations
  - enter 280ms slide-up; exit 200ms; swipe down or Esc closes
  - `role="dialog"` with `aria-modal` matching the mode, `aria-labelledby` pointing at the headword

### 11.10 Quiz option
- **Anatomy:** `<button>` card, grid of `36px | 1fr | auto`:
  - letter in a 36px circle (1.5px `--line-control` border, Atkinson 800 16)
  - text (Literata 18/25)
  - trailing slot for the tick
- **Box:** 1.5px `--line-control` border, 12px radius, 12/16 padding, min height 60, 12px between
  options.
- **States:**
  - idle, hover (`--ink` border + `--sheet`), focus
  - first try (§4.3: dashed border, hatch strip, pen cross on the letter, strike-through, label)
  - right answer (2px `--ink` border, pen `ring` on the letter, pen tick, label, weight 600)
  - after solving, the other options are `disabled` but keep full contrast
- **Flow:** one question per view, with a "Question 2 of 5" progress line. A wrong pick leaves
  the others enabled ("try again" is implicit). The explanation note appears in the margin
  (desktop) or below the actions (mobile).
- **Actions:** primary "Next question"; ghost "Show me where it says so", which scrolls to the
  evidence sentence and draws a pen `underline` under it.
- Feedback is announced through `aria-live="polite"`.

### 11.11 Progress bar
A pen line on a dotted track: an SVG in a 100×12 box, stretched.
- **Track:** 1.5px `--line-control`, `stroke-dasharray: 1 5`.
- **Fill:** 3px `--ink` hand-drawn path to `x = 1 + 98 × value`.
- **Label:** always beside it in text ("Question 2 of 5", "Paragraph 2 of 5", "Card 2 of 5").
- `role="progressbar"` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax` on the wrapper.
- XP to the next level uses the same component, 240px wide, with "140 XP to Wordsmith".

### 11.12 Writing editor and feedback
- **Editor:**
  - `<textarea>` with Literata 20/1.9 (19 on mobile), 1.5px `--line-control` border, 12px radius,
    16/20 padding, max width 36em
  - footer row: vocabulary chips, then word count ("**38** words, aim for 30 to 80") and the
    autosave state ("Saved on this device" after 800ms idle, `aria-live`)
- **Get notes:**
  - a primary button, with the AI disclosure line under it
  - while working, a checklist of the *real* steps; each gets a pen tick as it completes
- **Feedback state:**
  - the draft renders as text with marks: `loop` or `double` under quoted glow phrases, and a
    `caret` at a suggested insertion point
  - each marked span has `aria-describedby` pointing at its note
  - notes are an unordered list in the margin (desktop) or under the editor (mobile)
  - note anatomy: a small icon showing the same mark (28×18), a kind label (Bodoni 800 22:
    "Working" or "Try next"), and a sentence that quotes the student in Literata italic
  - always 2 "Working" notes before at most 2 "Try next"; never more than 4 marks
  - the student can hide marks ("Hide notes"); their writing is never rewritten

### 11.13 Streak display
- **Big form (`/me`, landing notebook):**
  - Atkinson 800 numeral (112px desktop, 88px mobile) with "days in a row" (17 700) under it
  - the `tally` SVG, 72px tall: groups of five, today's pending stroke dashed in `--ink-3`
  - a caption: "Read one story today to make it 13."
  - the SVG is `role="img"` with `aria-label="12 tally marks. Today's mark is waiting."`
  - when today's first read completes, the pending stroke is redrawn solid (pen-short)
- **Compact form (Today strip):** a 22px-tall mini tally plus "**12 days** in a row".
- A broken streak never shows a zero in big type. It shows "Welcome back. Start a new line today."
  with the longest streak as a caption.

### 11.14 Stat tile (`/me`)
- 1px `--line-soft` border, 4px radius, 20px padding.
- Value: Atkinson 800 36/40 tabular (24 on mobile). Label: 13–14/16 in `--ink-3`.
- Optional pen `progress` line under it.
- 4-up on desktop, 2×2 on mobile.
- Tiles: stories read, words collected, journal entries, best streak.

### 11.15 Badge / stamp
- **Seal:** 96px SVG with an outer pen `ring` and an inner disc. **Earned:** the disc is filled with
  `--ink`, and the numeral or glyph is in `--paper` (Atkinson 800 50px, or 42px for two digits).
  **Locked:** both rings dashed `3 6` in `--ink-3`, and the numeral is outlined.
- Caption: name (15 700) and how it was earned (14 `--ink-3`, max 18ch). Locked stamps read
  "Next: …".
- `role="img"` with `aria-label="Stamp earned: 7 days in a row"`.
- Earning one plays the thunk (240ms) and a toast.
- The 12 stamps in SPEC §7 each get a numeral or glyph:

  | Stamp | Face |
  |---|---|
  | first-story | 1 |
  | first-word | W |
  | words-10 | 10 |
  | words-50 | 50 |
  | first-entry | quill glyph |
  | perfect-quiz | 5/5 |
  | streak-3 | 3 |
  | streak-7 | 7 |
  | streak-30 | 30 |
  | all-four | 4 |
  | writer-5 | 5 |
  | reviewer-50 | 50 |

  First-entry uses the quill glyph at 44px. Stamps whose faces collide (for example writer-5 and
  reviewer-50) are told apart by their caption.

### 11.16 Toast
- **Look:** inverted (`--ink` background, `--paper` text), 4px radius, 48px min height, 16px
  padding, max 480px wide.
- **Position:** bottom centre, 16px above the tab bar or sheet.
- **Content:** text plus an optional text action ("Undo") with an underline.
- **Timing:** 5s, pausing on hover and focus. Enter 160ms fade and 8px rise.
- `role="status"`. Error toasts use the same look, with a circled "!" glyph and
  `role="alert"`. There is only ever one toast.

### 11.17 Empty state
- An outlined, dashed (`--ink-3`) sketch of the thing that will live here. For example, three
  dotted-underlined sample words for Words, or a ruled page with a caret for Journal.
- Then a one-line heading (Bodoni 800 26), one sentence (17 `--ink-2`) and exactly one button.
- Centred in the content column, with 64px vertical padding.

### 11.18 Skeleton loader
- `--sheet` blocks with 4px radius, at the exact final size (so there is no layout shift).
  Text lines are 60–90% width and as tall as the line height.
- Shimmer: a 1.6s linear background-position sweep between `--sheet` and
  `color-mix(in srgb, var(--sheet), var(--ink) 4%)`. Off under reduced motion.
- **Local-store islands** (streak, counts, continue reading) render their skeleton on the server
  (`useSyncExternalStore` returns null there) and swap in place.

### 11.19 Flashcard
- **Card:** 1.5px `--ink` border, 16px radius, 24px padding, min height 300 (440 on mobile
  practice), with a second card edge peeking 8px below (a pseudo-element) to suggest the stack.
- **Front:** a "Front of the card" label (14 700 `--ink-3`), the word (`flash-word`) with its
  current mastery mark, and the hint "Tap the card or press Space to flip".
- **Back:** the word, definition (Atkinson 19/28), example (Literata italic 18), and "From
  '{story title}'" (14 `--ink-3`).
- **Grade buttons** (after the flip): a 4-column grid of 64px 12px-radius buttons: **Again,
  Hard, Good, Easy**, each with a "Press 1–4" caption. Good is emphasised with a 2px border.
- **Keyboard:** Space flips; 1–4 grade; Esc ends the round.
- **Mobile, before the flip:** one block primary "Flip the card".
- After grading, the next card slides in 200ms. The mastery mark animates only when it goes up.
- **Summary:** "5 words practised. 3 moved up." plus the new marks in a row, one primary
  "Back to your words".

### 11.20 Reading settings panel
- A popover under the Aa button (desktop, 320px wide, 1.5px `--ink` edge, 12px radius) or a modal
  bottom sheet (mobile).
- **Rows** (label 15 700, then a segmented control):
  - **Font:** Book | Clear
  - **Size:** S | M | L | XL
  - **Line spacing:** Normal (1.6) | Relaxed (1.72) | Loose (1.9)
  - **Theme:** System | Light | Dark
- A live preview sentence at the top.
- Changes apply immediately and persist to `prefs`.
- **Listen:** a separate icon button. While playing it becomes a 44px pill "Pause", and the current
  word is inverted via `::highlight(wiege-listen)`. It is hidden when speech isn't supported.

### 11.21 Small parts
- **Count pill:** 28px (24 in the app nav), `--ink` fill, Atkinson 800 15, tabular. It ticks on
  change.
- **Words-kept meter:** three 22px pen boxes and "**1** of 3 words kept" (15 600). A box gets a
  pen tick when its word is saved.
- **Meta row:**
  - icon-led items separated by an 18px gap, 15px 600 `--ink-2`
  - the category item is `--ink` 700 with its glyph
  - never joined with middle dots
- **Freshness line:** clock icon plus the text. The countdown updates every minute. It is computed
  from the real schedule (00/04/08/12/16/20 UTC) and the last successful ingest.
- **Grade chip** (first-visit Today, and in the reader): segmented "Grade 7–8 | Grade 9–10". It is
  optional and never blocks reading.

---

## 12. Page layouts

The ASCII wireframes are not to scale. `[Btn]` is a filled button, `(Btn)` is secondary, and
`~word~` is a pen mark. In wireframes, `·` only separates notes; it is never rendered in the UI
(meta items are separated by space and icons, §11.21).

### 12.1 `/` landing
```
DESKTOP ≥1280                                              nav 64, sticky
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Wiege⌣     Today's stories  How it works  For parents and teachers  Words (0) (Start reading) │
├──────────────┬───────────────────────────────────────────────┬───────────────────────┤
│ h1 pitch 21  │ (Practice story) ✎Games  ◷3 min read  Grade 7–8 │                       │
│ sub 16       │ SPEEDRUNNERS                                  │ ⌈ rehearse  verb      │
│              │ (rehearse) ONE      ←───────────────────────── │ │ Say it: ri-HURSS…   │
│ [Start       │ JUMP HUNDREDS OF                              │ │ definition          │
│  reading]    │ TIMES TO shave off                            │ │ example (italic)    │
│ Free. No     │ A SINGLE SECOND           display-xl 78/900   │ │ Word history. …     │
│ sign-up. …   │ standfirst 21/1.65 … know it by heart.        │ ⌊ (+ Save word) (♪)   │
│ try it ↘     │ □□□ 0 of 3 words kept                         │                       │
├──────────────┴───────────────────────────────────────────────┴───────────────────────┤
│ Four corners of the news. / lede                                                     │
│ [tile Writing] [tile Games] [tile Art] [tile Sports]   glyph, name, line, N new, Latest │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Fresh from the last four hours.                ◷ Updated at 12:00. Next drop in 1 h 52 │
│ [M card, inverted cover + my pick] [M card] [M card]                                  │
│ See all stories                                                                       │
├──────────────┬───────────────────────────────────────────────┬───────────────────────┤
│              │ Every story is a short lesson. / lede           │                       │
│ 1 Read       │ [Grade 7–8|9–10] (Aa) (♪) / meta / reader-title │ margin note           │
│ 2 Check      │ Question 2 of 5 ───···  / 4 choice cards         │ Got it on the second… │
│ 3 Write      │ prompt / editor with marks / real steps ✓        │ Notes on your draft   │
├──────────────┴───────────────────────────────────────────────┴───────────────────────┤
│ Your notebook fills up as you read.                                                   │
│ Words, marked by how well you know them │ Days you read: 12 + tally, then Stamps ○○○◌  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Private by design.  [lock] No accounts  [eye] No tracking, no ads  [phone] Your words… │
├──────────────────────────────────────────────────────────────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓▓ Your first story is already waiting.  [Start reading]  Free. No sign-up. ▓▓│
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Wiege⌣ + one line           Today  About / Explore  Privacy / Your words  Parents   [System|Light|Dark] │
└──────────────────────────────────────────────────────────────────────────────────────┘

MOBILE 390                         nav 56: Wiege⌣  (Start reading)  ☰
 h1 pitch 21/800 (3 lines) · sub 16
 [Start reading]  (above the fold at 360×640)
 Free. No sign-up. …
 try it: tap a dotted word ↓
 (Practice story) ✎Games ◷3 min read / Grade 7–8
 SPEEDRUNNERS / REHEARSE ONE / JUMP HUNDREDS OF / TIMES TO SHAVE OFF / A SINGLE SECOND  (36px)
 [note appears inline here when a word is tapped]
 standfirst 19 · □□□ 0 of 3 words kept
 Four corners: 4 tiles, one column, glyph-left
 Fresh: 3 M cards (cap 6), See all stories
 How it works: step number + title row, then content; notes inline
 Notebook: pages stack · Promises: glyph-left list · Band · Footer (2-col links, 44px rows)
 sticky CTA bar appears after the hero CTA scrolls away
```
Notes:
- The hero demo is a **practice story** (`getLandingDemoStory()`), labelled with the "Practice
  story" tag and never presented as news.
- Pre-open the first word only at 1024px and up (first-screen discipline). The 1366×768
  Chromebook first screen shows the pitch, CTA, full headline, standfirst, meter and the open
  note.
- Section heads never pair "heading left + grey subline right". The heading and lede stack; the
  freshness line is the only right-aligned element.
- The landing page's one orchestrated motion moment is the hero pen draw.

### 12.2 `/today`
```
DESKTOP (app nav)                                                       max 1280
┌──────────────────────────────────────────────────────────────────────────────┐
│ Wiege⌣  (Today) Explore  Words (23)  Journal  Me                        (⌕)  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Good afternoon.  h1 64                 卌卌|| 12 days in a row · 23 words, 5 to │
│                                        practise · Storyteller, 140 XP to…   │
├───────────────────────────────────────────────┬──────────────────────────────┤
│ Continue reading                               │ Today's story                │
│ [S row: thumb · title · Question 3 of 5 ──··] │ [L pick: inverted cover       │
│ [S row: thumb · title · Paragraph 2 of 5 ─··] │  "manuscript"~, why line,     │
│ [Keep reading the relay story]  ← only filled  │  title, meta, (Read this…)]  │
│                                               │ ┌ 5 words are ready ─ stack ┐ │
│ Latest: ✎Writing See all | ⌘Games | Art | Sports  (2 headlines each)        │ │ Practise 5 words          │ │
│                                               │ └───────────────────────────┘ │
│ ◷ Updated 2 hours ago. Next drop in 1 h 52 min.                              │
└───────────────────────────────────────────────┴──────────────────────────────┘
MOBILE: appbar 56 (Wiege⌣ · ⌕) → greeting 40 + strip (wraps) → Continue reading (1–3 S rows)
→ [Keep reading] block → Today's story (L) → Practise panel → Latest (1 per category, See all)
→ freshness → tab bar (Today active)
```
Notes:
- Order is fixed: **Continue reading first** (1–3 unfinished; hidden if none), then Today's story
  (the category read least this week), then Practise (only if words are due), then Latest.
- **First visit** (empty store): the greeting is "Start here." with the grade chip ("Which grade
  are you in? This picks your reading level. You can change it any time.") and Today's story as
  the only card, with a filled "Read today's story".
- Streak and counts are islands with reserved height.

### 12.3 `/c` explore and `/c/[category]`
```
/c  DESKTOP: h1 "Explore" · lede → 4 category tiles (§11.7, larger: min-height 380, 3 latest headlines)
/c/[category]  DESKTOP
┌──────────────┬────────────────────────────────────────────────────────────────┐
│ glyph 72     │ h1 "Games" (Bodoni 900 64) · description · "9 new today"        │
│              │ [M card][M card][M card]                                        │
│              │ [M card][M card][M card]  (12, newest first; ✓ Read on done)   │
│              │ (Load more stories)                                            │
│              │ Practice stories: "Practice story" tag on each                  │
└──────────────┴────────────────────────────────────────────────────────────────┘
MOBILE: glyph 56 + h1 40 inline → M cards single column (16 gap) → Load more (secondary, block)
```
Unknown slug gives the 404. Loading more appends cards with no layout jump; focus moves to the
first new card.

### 12.4 `/read/[slug]` (the core)
```
DESKTOP ≥1280 (folio)
┌──────────────┬───────────────────────────────────────────────┬──────────────────────┐
│ ‹ Today      │ [Grade 7–8|9–10]  (Aa) (♪ Listen)   sticky 10 │                      │
│ ✎ Games      │ reader-title 36/800                            │                      │
│ ◷ 5 min read │ standfirst 21                                  │                      │
│ From Pocket  │ read 20/1.72, max 32em                         │ ⌈ narrative  noun    │
│ Gamer ↗ link │ … “The ~narrative~ matters more …  ←───────── │ │ Say it · def ·     │
│              │ … collaborate(squiggle: seen) …               │ │ In this story ·    │
│              │                                               │ ⌊ example · extra    │
│ 2 Check      │ Check your understanding: Q n of 5 + choices   │ explanation note     │
│ 3 Write      │ 3 prompt cards → editor → Get notes            │ Notes on your draft  │
│ Talk about it│ 2 discussion questions (Literata 20)           │                      │
│              │ Read the original at Pocket Gamer (link)       │                      │
│              │ (I finished reading) when the quiz is skipped  │                      │
└──────────────┴───────────────────────────────────────────────┴──────────────────────┘
MOBILE 390
 ‹  ✎Games                          (Aa) (♪)      ← reader bar 56, sticky
 [Grade 7–8 | Grade 9–10]
 reader-title 28 · meta · standfirst 19
 read 19/1.72 … tapped word ~looped~
 ┌──────────── bottom sheet (non-modal, ≤50svh) ────────────┐
 │ ▬  prototype noun                                   (×)  │
 │ Say it · def · example · Word root · (+ Save word) (♪)   │
 └──────────────────────────────────────────────────────────┘
 (tab bar hidden while scrolling down)
```
Notes:
- The reading column never moves when a note opens.
- The "Look up a word" field (keyboard users) lives in the Aa panel.
- The level switch keeps the scroll position by paragraph index and keeps the open word open if
  it exists at the new level.
- Quiz completion shows the summary (score, XP, any new stamp) and marks the story done.
- The original source is always linked with its name. Story art is not shown in the reader; the
  type is the art.

### 12.5 `/words` and `/words/practice`
```
/words DESKTOP
┌─────────────────────────────────────────────────┬─────────────────────────────────┐
│ Your words (h1)   23 words saved · 5 ready       │                [Practise 5 words]│
│ [⌕ Search your words        ] [Due first|A–Z|Newest]                              │
│ legend: word⋯ Just met  ~word~ Seen it  word_ Getting there  word═ Nearly  (word) … │
│ row: ~stamina~ noun ............................................ Due now          │
│      The strength to keep going for a long time.                                  │
│ row: rehearse⋯ verb ............................................ Due now          │
│ … (swipe or ⋯ menu → Remove → toast with Undo)                                     │
└─────────────────────────────────────────────────┴─────────────────────────────────┘
/words/practice DESKTOP: centred column 560 → Card 2 of 5 ───···· → flashcard → grade row
MOBILE: stacked; [Practise 5 words] block under the title; practice is full screen with (×)
```
- **Empty:** §10.
- **Nothing due:** the Practise button becomes secondary: "Practise anyway (3 random words)".
- Up to 20 cards per round.

### 12.6 `/journal`, `/journal/new`, `/journal/[id]`
```
/journal: h1 "Journal" · [New entry] → list rows: title (Bodoni 700 22) · prompt kind · 38 words
          · "Notes ready" or "No notes yet" · date (14 --ink-3). Rows are S-card style (88px).
/journal/[id] (folio): left = ‹ Journal, story link, prompt kind; middle = prompt (question 23) +
          editor (autosave, word count, vocab chips) + [Get notes on my writing] + disclosure;
          right = feedback notes. Delete: ghost "Delete entry" → modal sheet "Delete this entry?
          It's only on this device, so it can't come back." [Delete entry] (Keep it).
/journal/new: prompt picker (3 cards from the story or "Free write") → same editor.
```

### 12.7 `/me` (progress, stamps, settings entry, backup)
```
DESKTOP
 h1 "Me" · level line: Storyteller · pen progress ─── 140 XP to Wordsmith
 [stat: 14 stories read] [stat: 23 words] [stat: 4 journal entries] [stat: 12 best streak]  4-up
 spread (1.5px ink spine):  left: streak big numeral + tally  │ right: 12-week calendar
   (7 rows × 12 columns of 14px cells: read day = short pen slash; no read = 4px dot --line-control;
    today = dashed ring)
 Stamps: grid of 12 seals (4 columns desktop, 2 mobile): earned first, then locked
 Backup reminder panel (1px border): "Last backup: never. Save a backup file so a new device can have your words." (Save a backup file)
 Link: Settings
MOBILE: stat tiles 2×2; spread pages stack; calendar scrolls horizontally inside its box only
```

### 12.8 `/settings`
Single column of max 640, with sections separated by 48px:
- **Grade** (segmented)
- **Reading** (font, size, spacing, with a live preview)
- **Theme** (System | Light | Dark)
- **Writing notes:** a switch "Use AI to write notes on my writing" with the disclosure paragraph
- **Your data:**
  - "Save a backup file" (primary; downloads `wiege-backup-YYYY-MM-DD.json`)
  - "Restore from a backup" (secondary). It opens a preview sheet ("This file has 23 words,
    4 entries and 3 stamps") with the choices "Merge with this device" and "Replace this device".
  - "Clear everything on this device": a ghost button that opens the type-to-confirm modal

### 12.9 `/about`, `/privacy`, `/parents`
- **Layout:** folio with the left margin as a sticky table of contents (links 15px 700), the text
  column as reading prose (Literata 20, max 32em, `h2` 32), and the right margin holding plain
  bracketed callouts. No pen marks on these pages: nobody is reading to learn a word here.
- **`/privacy`:** short plain sections: "What stays on your device", "What leaves your device (only
  when you ask for notes on your writing)", "What we never collect", "How to back up, move or
  delete your data".
- **`/parents`:** How Wiege works (the 1–2–3 sequence), How stories are chosen (sources, the safety
  filter, the 4-hour schedule), Where progress lives, Using Wiege in class, Contact
  (`WIEGE_CONTACT_EMAIL` as a mailto link).

### 12.10 404 and error
```
 centred column 560, 128px top padding (64 mobile)
 a big dotted-underlined word "moved" in Bodoni 900 96 (56 mobile), with a pen loop around it
 h1 "This page has moved on."   17 --ink-2 one line   [See today's stories]
```
- The error page (`error.tsx`) uses the same layout: the word is "hiccup" with a `cross` mark,
  "This page didn't load. Check your connection, then try again.", and [Try again] calls
  `reset()`.
- `global-error.tsx` must not depend on fonts loading.

### 12.11 `/login` and `/signup` (only if accounts are enabled; not in current scope)
```
 centred column 440 on paper; wordmark above; no nav links
 /signup: h1 "Make your reading space" (Bodoni 900 40)
   Username  [____________]   helper: "Don't use your real name."
   Password  [__________ Show]  helper: "8 characters or more."
   Grade     [Grade 7–8 | Grade 9–10]
   [Start reading]   micro: "No email. No real name. That's all we need."
   Already have one? Log in (link)
 /login: h1 "Welcome back" · Username · Password (Show) · [Log in] · no "forgot password" (no email):
   helper "Forgot it? Ask a parent or teacher to help you make a new one."
 After sign-up: go straight to today's story (no wizard).
```

---

## 13. Accessibility rules (WCAG 2.2 AA, checked, not estimated)

1. Every text and background pair uses the tokens in §4.1 (all ≥ 4.5:1). Control boundaries use
   `--line-control` (≥ 3:1). Never put text on `--line-soft`, on a pattern or on a cover.
2. Landmarks: `header`, `nav` (labelled "Main", "App", "Footer"), `main#main`, `footer`. Include a
   skip link ("Skip to content"). Exactly one `h1` per page, with logical heading order. On the
   landing page the `h1` is the pitch; the poster headline is an `h2`.
3. **Pen marks are `aria-hidden`.** Their meaning is always in text or in an accessible name:
   - "Right answer" and "Your first try" labels, plus "Not correct." for screen readers
   - the tap button's label
   - the tally's and seals' `role="img"` labels
   - mastery in the row's text ("Seen it")
4. Tap words are real `<button>`s with `aria-expanded`, `aria-controls`, and
   `aria-label="{word}: show what it means"`. Notes are `aria-live="polite"` regions. Opening a
   sheet moves focus to its headword; closing returns focus to the word.
5. Keyboard: everything reachable in visual order, the 3px focus ring always visible, and no
   keyboard traps (except in modal dialogs, which trap and restore focus).
   - Flashcards: Space flips; 1–4 grade.
   - Quiz: arrow keys move between choices; Enter picks.
   - Esc closes notes, sheets and the drawer.
6. Targets are at least 44×44 with 8px spacing (inline text links and tap words excepted). Inputs
   are at least 16px. Reading text is at least 18px. Nothing smaller than 14px except tab labels and
   count badges (12px, 700–800).
7. Motion: see §6. Nothing flashes. Reduced motion shows final states.
8. Zoom to 200% and 400% (reflow at 320 CSS px) with no loss. Line length stays within 32em. No
   `overflow-x: hidden` on `body`; fix overflow at its source.
9. Forms: visible labels, `autocomplete` where relevant, errors linked with `aria-describedby`,
   `aria-invalid`, and a summary focused on submit if there is more than one error.
10. Speech features are feature-detected and hidden if unsupported. The "Say it" respelling always
    remains as text.
11. Language: `lang="en"`. Foreign words in notes (for example *protos*) get `lang="el"`.
12. Test with VoiceOver (iOS Safari) and NVDA (Chrome); axe with no violations; Sentinel
    `audit_accessibility` with zero blockers; Lighthouse Accessibility 100.

---

## 14. Psychology mapping (honest by construction)

Every row must still work if the student knows exactly how it works.

| Principle | Element | Checkable decision |
|---|---|---|
| Reciprocity (give before you ask) | Landing hero tap-a-word demo on a practice story | The hero's first interactive element is a tap word (tab order: skip link, nav, pitch CTA, tap words). Tapping and saving work with no prior step. |
| Ask only what's needed | Grade chip (first visit, optional). If accounts ever exist: username + password + grade band only. | No email, name or birthday field exists anywhere. The grade chip can be skipped (reading defaults to 7–8). |
| First-session value | "Start reading" CTA | Goes to `/today`, where "Read today's story" is the first filled button. No settings wizard, avatar or onboarding carousel. |
| Resume where you left off | `/today` → Continue reading | This block renders before anything new when 1–3 unfinished reads exist in the store. Hidden (not empty) otherwise. |
| IKEA effect / visible stored work | Nav Words count; Today strip (streak, words, level); `/me` stats, stamps, calendar; export | The count updates within 100ms of saving. Every stored item is visible somewhere. "Save a backup file" is one tap from `/me` and `/settings`. |
| Goal gradient / small quests | "0 of 3 words kept" meter; "Question 2 of 5"; "140 XP to Wordsmith"; "Card 2 of 5" | Each has a real denominator from real data. No fake progress (no bars that start pre-filled). |
| Mastery made visible | The pen mark on each word (§8.8) | The mark equals the Leitner box, 1:1, and changes only when the box changes. |
| Labor illusion (real steps) | Writing feedback checklist | The four steps shown are the steps actually executed. Each ticks when that step's promise resolves; there are no timers faking duration. |
| Hick's law | 4 categories; 5 app destinations; one Today's story | The nav never exceeds 5 links. Today recommends exactly one story. |
| Loss aversion, used kindly | Streak | There is no "you lost your streak". Missing a day shows "Welcome back. Start a new line today." and keeps the longest streak visible. No streak freezes are sold or nagged. |
| Honest scarcity / timeliness | "Next drop in 1 h 52 min" | Computed from the real ingest schedule and last run. Never shown if ingest is failing (then: "Updated 9 hours ago"). |
| Endowment / ownership | Pen marks on *your* words and writing | Marks appear only after the student acts. Nothing is pre-marked on first visit (the meter starts at 0). |
| Social proof | none | No testimonials, user counts, ratings or school logos, anywhere. |
| Protective defaults | Privacy | No trackers, no cookies. AI notes are disclosed next to the button and can be turned off. Clearing data requires typing "clear". Cancelling is as easy as starting. |
| Doherty threshold | All interactions | Loop starts on `pointerdown`. Saves are optimistic. The UI responds in under 400ms. Skeletons match the final layout. |

---

## 15. Implementation map

```
src/app/globals.css              tokens (§4.2), base, pen CSS (§8.4), reduced motion
src/app/fonts.ts                 next/font setup (§3.1)
src/components/ink/
  pen.ts                         fnv1a, mulberry32, smooth, path generators (§8.2–8.3) — isomorphic
  PenMark.tsx                    server-safe <svg class="pm pm--{kind}"> renderer
  use-pen-draw.ts                'use client' drawIn() + leader/margin placement hook
  Tally.tsx, Seal.tsx, Bracket.tsx, ProgressLine.tsx, MeterBoxes.tsx
  StoryArt.tsx                   key-word cover (§8.9) + bodoni-advances.json
  CategoryGlyph.tsx              glyphs (§9) + Wordmark.tsx
src/components/ui/               Button, IconButton, Input, PasswordInput, Segmented, Chip, Tag,
                                 CountPill, Sheet, Drawer, Popover, Toast, Skeleton, EmptyState
src/components/layout/           SiteNav (landing/info), AppNav, TabBar, MobileCtaBar, Footer, Folio
src/components/reader/           TapWord, MarginNote, ReaderToolbar, ReadingSettings, ListenButton
src/components/quiz/             QuizOption, QuizRunner, QuizSummary
src/components/words/            WordRow, MasteryMark, Flashcard, PracticeRunner
src/components/journal/          WritingEditor, FeedbackNotes, FeedbackSteps
src/components/progress/         StreakDisplay, StatTile, Calendar12w, StampWall, LevelLine
```

**Definition of done for any screen:**
- matches this file at 360, 390, 768, 1024, 1366×768 and 1440, in light and dark
- one filled action per viewport
- pen marks only where §2 allows
- every numeral in Atkinson
- reading measure 56–70 characters
- reduced motion correct
- Lighthouse 100 ×4 (mobile + desktop)
- Sentinel `audit_mobile` and `audit_accessibility` with zero blockers
