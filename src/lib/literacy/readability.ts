import { tokenizeWords } from '@/lib/progress/text';
import type { GradeBand, LessonContent, LessonLevel } from '@/lib/literacy/types';

/**
 * Readability helpers (SPEC §6). Isomorphic: used by the reader (reading
 * minutes), the writing feedback in the browser and the lesson generator.
 */

/** Silent reading speeds by grade band (words per minute). */
export const READING_WPM: Readonly<Record<GradeBand, number>> = { '7-8': 200, '9-10': 230 };

// Words the vowel-group rules below miscount. Keys are lower-case letters only.
const SYLLABLE_EXCEPTIONS: Readonly<Record<string, number>> = {
  every: 2,
  everyone: 3,
  everything: 3,
  different: 3,
  business: 2,
  people: 2,
  area: 3,
  idea: 3,
  ideas: 3,
  create: 2,
  created: 3,
  creates: 2,
  creating: 3,
  creative: 3,
  science: 2,
  scientist: 3,
  scientists: 3,
  poem: 2,
  poems: 2,
  poet: 2,
  poetry: 3,
  quiet: 2,
  diet: 2,
  museum: 3,
  museums: 3,
  hundred: 2,
  hundreds: 2,
  toward: 2,
  towards: 2,
  cruel: 2,
  fuel: 2,
  real: 1,
  really: 3,
  lion: 2,
  lions: 2,
  violin: 3,
  olympic: 3,
  olympics: 3,
  whole: 1,
  somewhere: 2,
  something: 2,
  sometimes: 2,
  someone: 2,
  anyone: 3,
  maybe: 2,
  because: 2,
  eye: 1,
  eyes: 1,
  once: 1,
  one: 1,
  ones: 1,
  sure: 1,
  there: 1,
  where: 1,
  were: 1,
  here: 1,
  fire: 1,
  hour: 1,
  hours: 1,
  our: 1,
  being: 2,
  seeing: 2,
  going: 2,
  doing: 2,
  rhythm: 2,
  rhythms: 2,
  genuine: 3,
  recipe: 3,
  simile: 3,
  apostrophe: 4,
  achieve: 2,
  achieved: 2,
};

const VOWEL_GROUP = /[aeiouy]+/g;
// Built with RegExp() because the tsconfig target (ES2017) rejects \p{...} in literals.
const ANY_LETTER = new RegExp('\\p{L}', 'u');
const SINGLE_CAPITAL = new RegExp('^\\p{Lu}$', 'u');

/**
 * Estimated syllables in one English word (vowel groups with the common silent
 * and split-vowel rules). Around 90% exact on everyday vocabulary, which is
 * what a readability estimate needs. Numbers count as two syllables.
 */
export function countSyllables(word: string): number {
  const trimmed = word.trim();
  if (!trimmed) return 0;
  if (/^[\d.,:%]+$/.test(trimmed)) return /\d/.test(trimmed) ? 2 : 0;

  let w = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']s$/, '')
    .replace(/[^a-z]/g, '');
  if (!w) return ANY_LETTER.test(trimmed) ? 1 : 0;
  // Own keys only: "constructor" or "toString" would otherwise hit Object.prototype and yield NaN.
  if (Object.hasOwn(SYLLABLE_EXCEPTIONS, w)) return SYLLABLE_EXCEPTIONS[w];
  if (w.length <= 3) return 1;

  let extra = 0;
  // "-ism" adds a syllable the vowel groups miss (prism, criticism).
  if (/ism$/.test(w)) extra += 1;
  // Vowel + "ing" splits into two syllables (seeing, flying, studying); "aying" is handled by the medial-y rule.
  if (/[aeiou]ing$|[^aeiou]ying$/.test(w)) extra += 1;
  // Split vowels: "ia" (media, trivia) unless -cial/-tial/-cian/-tian/-gian; "ua" (actual) unless after q/g.
  if (/ia/.test(w) && !/[ct]ia[ln]|gian/.test(w)) extra += 1;
  if (/[^qg]ua/.test(w)) extra += 1;
  // "io" (radio, biology) unless -tion/-sion/-cion/-gion/-xion or -cious/-tious/-xious.
  if (/io/.test(w) && !/[tscgx]ion|[ctx]ious/.test(w)) extra += 1;
  // "iet" (society, variety) and "ienc" after a non-c (experience, audience).
  if (/iet/.test(w)) extra += 1;
  if (/[^c]ienc/.test(w)) extra += 1;
  // Prefixes and endings where "eo" is two syllables (geography, neon, video).
  if (/^(geo|neo)|eo$/.test(w)) extra += 1;

  // Silent endings.
  if (/[^aeiouy]es$/.test(w) && !/(s|x|z|c|g|ch|sh)es$/.test(w)) {
    w = w.slice(0, -2);
  } else if (/ed$/.test(w) && !/[td]ed$/.test(w)) {
    w = w.slice(0, -2);
  } else if (/[^aeiouy]e$/.test(w) && !/[^aeiouy]le$/.test(w)) {
    w = w.slice(0, -1);
  }
  // A "y" is a consonant at the start (yes, yellow) and between vowels (player, loyal).
  w = w.replace(/^y/, '').replace(/([aeiou])y([aeiou])/g, '$1_$2');

  const groups = w.match(VOWEL_GROUP)?.length ?? 0;
  return Math.max(1, groups + extra);
}

// Abbreviations whose full stop does not end a sentence.
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'mt', 'jr', 'sr', 'vs', 'etc', 'eg', 'e.g', 'ie', 'i.e', 'no', 'nos',
  'approx', 'fig', 'inc', 'ltd', 'co', 'u.s', 'u.k', 'u.n', 'a.m', 'p.m', 'jan', 'feb', 'mar', 'apr', 'jun',
  'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'vol', 'ch', 'pp',
]);

const SENTENCE_END = /[.!?…]+["'”’)\]]*(?=\s|$)/g;

function endsWithAbbreviation(textBefore: string): boolean {
  const lastToken = /(\S+)$/.exec(textBefore)?.[1] ?? '';
  const bare = lastToken.replace(/^["'“‘(\[]+/, '').toLowerCase();
  if (ABBREVIATIONS.has(bare)) return true;
  // Initials such as "J." in "J. K. Rowling".
  return SINGLE_CAPITAL.test(lastToken.replace(/^["'“‘(\[]+/, ''));
}

/**
 * Splits text into sentences. Line breaks always end a sentence (headlines,
 * lists, poems); within a line, ., !, ? and … end one unless they follow a
 * known abbreviation or an initial. Returns trimmed sentences that contain at
 * least one word.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    let start = 0;
    SENTENCE_END.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SENTENCE_END.exec(line)) !== null) {
      const endChar = match[0][0];
      if (endChar === '.' && match[0].length === 1 && endsWithAbbreviation(line.slice(start, match.index))) continue;
      const end = match.index + match[0].length;
      pushSentence(sentences, line.slice(start, end));
      start = end;
    }
    pushSentence(sentences, line.slice(start));
  }
  return sentences;
}

function pushSentence(into: string[], raw: string): void {
  const sentence = raw.replace(/\s+/g, ' ').trim();
  if (sentence && tokenizeWords(sentence).length > 0) into.push(sentence);
}

export interface TextStatistics {
  words: number;
  sentences: number;
  syllables: number;
  /** Words per sentence (0 when there are no sentences). */
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
}

export function textStatistics(text: string): TextStatistics {
  const words = tokenizeWords(text);
  const sentences = splitSentences(text).length;
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  return {
    words: words.length,
    sentences,
    syllables,
    avgSentenceLength: sentences === 0 ? 0 : words.length / sentences,
    avgSyllablesPerWord: words.length === 0 ? 0 : syllables / words.length,
  };
}

/**
 * Flesch–Kincaid grade level, rounded to one decimal and clamped to 0–18
 * (0 for text without words).
 */
export function fleschKincaidGrade(text: string): number {
  const stats = textStatistics(text);
  if (stats.words === 0) return 0;
  const sentences = Math.max(1, stats.sentences);
  const grade = 0.39 * (stats.words / sentences) + 11.8 * stats.avgSyllablesPerWord - 15.59;
  return Math.round(Math.min(18, Math.max(0, grade)) * 10) / 10;
}

/** Whole minutes to read `input` (text or a word count) at the band's speed; at least 1. */
export function readingMinutes(input: string | number, band: GradeBand = '7-8'): number {
  const words = typeof input === 'number' ? Math.max(0, input) : tokenizeWords(input).length;
  return Math.max(1, Math.ceil(words / READING_WPM[band]));
}

/** The retelling of one level as plain text, paragraphs separated by blank lines. */
export function levelText(level: LessonLevel): string {
  return level.paragraphs.join('\n\n');
}

export function lessonReadingMinutes(content: LessonContent, band: GradeBand): number {
  return readingMinutes(levelText(content.levels[band]), band);
}

/** The reading grade stored with a lesson: Flesch–Kincaid of the default (Grade 7–8) retelling. */
export function lessonReadingGrade(content: LessonContent): number {
  return fleschKincaidGrade(levelText(content.levels['7-8']));
}
