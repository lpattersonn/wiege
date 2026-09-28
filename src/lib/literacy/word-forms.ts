/**
 * Isomorphic English inflection helpers: map a word as written ("discoveries",
 * "committed", "achieving") to the dictionary forms it could come from, so a
 * vocabulary word counts when a student uses another form of it.
 */

export type WordClass = 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition';

export interface BaseCandidate {
  base: string;
  /** Word classes this inflection can belong to; null means any (the word as written). */
  classes: readonly WordClass[] | null;
}

const NOUN_OR_VERB: readonly WordClass[] = ['noun', 'verb'];
const VERB: readonly WordClass[] = ['verb'];
const ADJECTIVE: readonly WordClass[] = ['adjective'];

const MIN_BASE_LENGTH = 3;

/** Lower-case, straight apostrophes, no possessive ending. */
export function normalizeWordToken(token: string): string {
  return token
    .normalize('NFC')
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/'s$|'$/, '');
}

function isDoubledConsonant(stem: string): boolean {
  const last = stem[stem.length - 1];
  return stem.length >= 4 && last === stem[stem.length - 2] && !'aeiou'.includes(last);
}

/**
 * Dictionary forms `token` could be an inflection of: plurals and third person
 * (-s, -es, -ies), past tense (-ed, -d, -ied, doubled consonants), -ing forms and
 * comparatives (-er, -est). With `derivations`, adverbs in -ly also map to their
 * adjective. The token itself always comes first.
 */
export function baseCandidates(token: string, options: { derivations?: boolean } = {}): BaseCandidate[] {
  const w = normalizeWordToken(token);
  const out: BaseCandidate[] = [{ base: w, classes: null }];
  const add = (base: string, classes: readonly WordClass[]) => {
    if (base.length >= MIN_BASE_LENGTH && base !== w) out.push({ base, classes });
  };

  if (w.endsWith('ies') && w.length > 4) add(`${w.slice(0, -3)}y`, NOUN_OR_VERB);
  else if (w.endsWith('es') && w.length > 3) {
    add(w.slice(0, -2), NOUN_OR_VERB);
    add(w.slice(0, -1), NOUN_OR_VERB);
  } else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) add(w.slice(0, -1), NOUN_OR_VERB);

  if (w.endsWith('ied') && w.length > 4) add(`${w.slice(0, -3)}y`, VERB);
  else if (w.endsWith('ed') && w.length > 4) {
    const stem = w.slice(0, -2);
    add(stem, VERB);
    add(`${stem}e`, VERB);
    if (isDoubledConsonant(stem)) add(stem.slice(0, -1), VERB);
  }

  if (w.endsWith('ing') && w.length > 5) {
    const stem = w.slice(0, -3);
    add(stem, VERB);
    add(`${stem}e`, VERB);
    if (isDoubledConsonant(stem)) add(stem.slice(0, -1), VERB);
    if (stem.endsWith('y')) add(stem, VERB);
  }

  if (w.endsWith('iest') && w.length > 5) add(`${w.slice(0, -4)}y`, ADJECTIVE);
  else if (w.endsWith('est') && w.length > 5) {
    add(w.slice(0, -3), ADJECTIVE);
    add(w.slice(0, -2), ADJECTIVE);
  }
  if (w.endsWith('ier') && w.length > 4) add(`${w.slice(0, -3)}y`, ADJECTIVE);
  else if (w.endsWith('er') && w.length > 4) {
    add(w.slice(0, -2), ADJECTIVE);
    add(w.slice(0, -1), ADJECTIVE);
  }

  if (options.derivations) {
    if (w.endsWith('ally') && w.length > 6) add(w.slice(0, -4), ADJECTIVE);
    if (w.endsWith('ily') && w.length > 5) add(`${w.slice(0, -3)}y`, ADJECTIVE);
    else if (w.endsWith('ly') && w.length > 4) {
      add(w.slice(0, -2), ADJECTIVE);
      add(`${w.slice(0, -2)}e`, ADJECTIVE);
    }
  }
  return out;
}

/** True when `a` and `b` are forms of the same word (e.g. "revealed" and "reveals"). */
export function sameWordFamily(a: string, b: string): boolean {
  const aBases = new Set(baseCandidates(a, { derivations: true }).map((c) => c.base));
  return baseCandidates(b, { derivations: true }).some((c) => aBases.has(c.base));
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NOT_WORD_CHAR = '[^\\p{L}\\p{N}]';

/** True when `text` contains `word` as a whole word (case-insensitive by default). */
export function containsWord(text: string, word: string, options: { caseSensitive?: boolean } = {}): boolean {
  if (!word) return false;
  const pattern = `(?:^|${NOT_WORD_CHAR})${escapeRegExp(word)}(?:$|${NOT_WORD_CHAR})`;
  return new RegExp(pattern, options.caseSensitive ? 'u' : 'iu').test(text);
}
