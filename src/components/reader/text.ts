/**
 * Small, isomorphic text helpers for the reader (no DOM, no server imports),
 * shared by the server page (segmenting the story, finding quiz evidence) and
 * the client islands (the word under a tap, "In this story" lines).
 *
 * Regexes are built with RegExp() because the tsconfig target (ES2017)
 * rejects \p{…} in literals.
 */

/** Letters, marks and digits: the characters a word is made of. */
const WORD_CHAR = new RegExp('[\\p{L}\\p{M}\\p{N}]', 'u');
const LETTER = new RegExp('\\p{L}', 'u');

/** Curly quotes → straight, one character for one character (offsets survive). */
export function straightQuotes(text: string): string {
  return text.replace(/[‘’‛′]/g, "'").replace(/[“”„″]/g, '"');
}

export function isWordChar(ch: string | undefined): boolean {
  return Boolean(ch) && WORD_CHAR.test(ch as string);
}

const isApostrophe = (ch: string | undefined) => ch === "'" || ch === '’';

/**
 * The word around `index` in `text` as [start, end), or null when `index`
 * isn't on a word. Words keep inner apostrophes ("don't", "keeper’s") but not
 * leading or trailing ones.
 */
export function wordBoundsAt(text: string, index: number): [number, number] | null {
  if (index < 0 || index > text.length) return null;
  const inWord = (i: number) => isWordChar(text[i]) || (isApostrophe(text[i]) && isWordChar(text[i - 1]) && isWordChar(text[i + 1]));
  let i = index;
  // A caret right after the last letter still counts as on the word.
  if (!inWord(i) && i > 0 && inWord(i - 1)) i -= 1;
  if (!inWord(i)) return null;
  let start = i;
  let end = i + 1;
  while (start > 0 && inWord(start - 1)) start -= 1;
  while (end < text.length && inWord(end)) end += 1;
  return LETTER.test(text.slice(start, end)) ? [start, end] : null;
}

/** A tapped word as a lookup key: lower case, straight apostrophes, no possessive ending. */
export function lookupKey(word: string): string {
  return straightQuotes(word.normalize('NFC'))
    .trim()
    .toLowerCase()
    .replace(/'s$/, '')
    .replace(/^'+|'+$/g, '');
}

const SENTENCE_END = /[.!?…]/;
const CLOSERS = /["'”’)\]]/;

/**
 * The sentence that contains `index`, trimmed. Long sentences are shortened
 * to about `maxWords` around the index, with ellipses where cut.
 */
export function sentenceAround(text: string, index: number, maxWords = 28): string {
  let start = 0;
  for (let i = Math.min(index, text.length) - 1; i >= 0; i--) {
    if (SENTENCE_END.test(text[i])) {
      let j = i + 1;
      while (j < text.length && CLOSERS.test(text[j])) j++;
      if (j >= text.length || /\s/.test(text[j])) {
        start = j;
        break;
      }
    }
  }
  let end = text.length;
  for (let i = Math.max(index, start); i < text.length; i++) {
    if (SENTENCE_END.test(text[i])) {
      let j = i + 1;
      while (j < text.length && CLOSERS.test(text[j])) j++;
      if (j >= text.length || /\s/.test(text[j])) {
        end = j;
        break;
      }
    }
  }
  const words: Array<{ word: string; end: number }> = [];
  const token = /\S+/g;
  const raw = text.slice(start, end);
  let match: RegExpExecArray | null;
  while ((match = token.exec(raw)) !== null) words.push({ word: match[0], end: start + match.index + match[0].length });
  if (words.length <= maxWords) return raw.trim();
  // Keep a window of maxWords around the word that holds the index.
  const at = Math.max(0, words.findIndex((w) => w.end >= index));
  const from = Math.max(0, Math.min(at - Math.floor(maxWords / 2), words.length - maxWords));
  const to = Math.min(words.length, from + maxWords);
  const middle = words
    .slice(from, to)
    .map((w) => w.word)
    .join(' ');
  return `${from > 0 ? '…' : ''}${middle}${to < words.length ? '…' : ''}`;
}

/** Wrap a sentence from the story in curly quotes for the "In this story" line. */
export function quoteSentence(sentence: string): string {
  return `“${sentence.replace(/^["“]+|["”]+$/g, '')}”`;
}

/** Quoted passages in a quiz explanation (straight or curly double quotes), longest first. */
export function quotedPassages(text: string): string[] {
  const found: string[] = [];
  const pattern = /["“]([^"“”]+)["”]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) found.push(match[1]);
  return found.sort((a, b) => b.length - a.length);
}

/**
 * Where `quote` appears in `text`, ignoring case and quote style, as
 * [start, end). Leading ellipses and trailing punctuation are dropped first;
 * if the whole quote isn't there, shorter prefixes (down to `minWords`) are
 * tried, since explanations sometimes paraphrase the end of a sentence.
 */
export function findPassage(text: string, quote: string, minWords = 4): [number, number] | null {
  const haystack = straightQuotes(text).toLowerCase();
  const cleaned = straightQuotes(quote)
    .replace(/^[\s.…]+/, '')
    .replace(/[\s.,!?;:…]+$/, '')
    .trim()
    .toLowerCase();
  const words = cleaned.split(/\s+/).filter(Boolean);
  for (let n = words.length; n >= minWords; n--) {
    const needle = words.slice(0, n).join(' ');
    const at = haystack.indexOf(needle);
    if (at >= 0) return [at, at + needle.length];
  }
  return null;
}

export interface Evidence {
  /** Paragraph index in the level's retelling. */
  para: number;
  start: number;
  end: number;
}

/** The passage a quiz explanation quotes, located in the retelling; null when it quotes nothing from it. */
export function findEvidence(explanation: string, paragraphs: readonly string[]): Evidence | null {
  for (const quote of quotedPassages(explanation)) {
    if (quote.trim().split(/\s+/).length < 4) continue;
    for (let para = 0; para < paragraphs.length; para++) {
      const hit = findPassage(paragraphs[para], quote);
      if (hit) return { para, start: hit[0], end: hit[1] };
    }
  }
  return null;
}
