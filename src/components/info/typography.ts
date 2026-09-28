/**
 * Typesetting for plain strings shown in prose (e.g. the `why` notes in
 * FEEDS, written in plain ASCII for code): curly apostrophes and quotes, and
 * numeral runs split out so they can be set in Atkinson (DESIGN §3.2).
 * Pure and isomorphic.
 */

/** Straight apostrophes and double quotes → typographic ones. */
export function curlyQuotes(text: string): string {
  return text
    .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
    .replace(/(\p{L}s)'(?=\s|$|[.,;:])/gu, '$1’')
    .replace(/"([^"\n]*)"/g, '“$1”');
}

export interface TextRun {
  text: string;
  numeral: boolean;
}

// A number, optionally with thousands separators, decimals, a range or a trailing "+": 20, 6,000, 42.195, 10–14, 12+.
const NUMERAL = /\d+(?:[.,]\d+)*(?:\s?[–-]\s?\d+(?:[.,]\d+)*)?\+?/g;

/** Splits text into plain and numeral runs, in order; joining the runs gives the input back. */
export function splitNumerals(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const match of text.matchAll(NUMERAL)) {
    const start = match.index ?? 0;
    if (start > last) runs.push({ text: text.slice(last, start), numeral: false });
    runs.push({ text: match[0], numeral: true });
    last = start + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), numeral: false });
  return runs;
}
