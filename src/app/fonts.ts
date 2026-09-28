import { Atkinson_Hyperlegible_Next, Bodoni_Moda, Literata } from 'next/font/google';
import localFont from 'next/font/local';

/**
 * Three families (DESIGN §3.1), each with one job, tuned for readability:
 * - Bodoni Moda 700/800/900: big, short display moments only (32px and up:
 *   hero, page and section titles, cover and flashcard words, the wordmark).
 * - Literata: all reading, plus every mid-size title (story titles, card titles,
 *   the reader headline, headwords) at weight 700 — it was drawn for screens.
 * - Atkinson Hyperlegible Next: everything you operate.
 * Digits everywhere come from a 4.6 KB Literata digits-only cut (see `digits`),
 * because Atkinson's slashed zero reads as "Ø".
 *
 * Put `fontVariables` on <html>; globals.css maps them to the Tailwind
 * `font-display` / `font-title` / `font-read` / `font-ui` utilities.
 */
export const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  style: ['normal'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-bodoni',
  // Quoted: next/font writes fallbacks verbatim, and an unquoted "Bodoni 72"
  // (a name ending in a number) is an invalid family that voids the stack.
  fallback: ["'Bodoni 72'", 'Didot', 'Georgia', 'serif'],
});

export const literata = Literata({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-literata',
  fallback: ['Georgia', "'Times New Roman'", 'serif'],
});

export const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-atkinson',
  fallback: ['system-ui', '-apple-system', "'Segoe UI'", 'sans-serif'],
});

// Literata's 0–9 only (subset with fontTools from the Google Fonts file, wght
// 200–900, tnum kept). Listed first in the UI stack, so every digit renders with
// a plain zero and a flagged one while letters stay Atkinson.
export const digits = localFont({
  src: './_fonts/literata-digits.woff2',
  weight: '200 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-digits',
  declarations: [{ prop: 'unicode-range', value: 'U+0030-0039' }],
  adjustFontFallback: false,
});

export const fontVariables = [bodoni.variable, literata.variable, atkinson.variable, digits.variable].join(' ');
