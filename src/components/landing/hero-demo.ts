import type { CategorySlug } from '@/lib/categories';
import { lessonReadingMinutes } from '@/lib/literacy/readability';
import type { LessonContent, VocabularyItem } from '@/lib/literacy/types';
import { baseCandidates, normalizeWordToken } from '@/lib/literacy/word-forms';

/**
 * The landing hero's tap-a-word demo (DESIGN §12.1), built on the server from
 * the practice story (getLandingDemoStory) so only the few strings the island
 * needs reach the client: the Grade 7–8 title, one short passage split into
 * text and tappable vocabulary words, and a note per word. Pure and
 * isomorphic; no story data is invented here.
 */

export type PassagePart =
  | { kind: 'text'; text: string }
  /** A vocabulary word as written in the story, plus punctuation kept on its line. */
  | { kind: 'word'; text: string; trailing?: string };

export interface HeroNote {
  /** Lower-cased word as written in the passage (the TapWord's `word`). */
  key: string;
  /** Headword to show and save (the vocabulary entry). */
  word: string;
  partOfSpeech?: string;
  definition: string;
  example?: string;
}

export interface HeroDemo {
  slug: string;
  category: CategorySlug;
  title: string;
  /** Reading time of the Grade 7–8 retelling. */
  minutes: number;
  passage: PassagePart[];
  notes: HeroNote[];
}

export interface DemoStoryInput {
  slug: string;
  category: CategorySlug;
  content: LessonContent;
}

/** Three words fill the "0 of 3 words kept" meter (DESIGN §11.21). */
export const HERO_WORD_COUNT = 3;

const WORD_TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const SENTENCE_BREAK = /(?<=[.!?…][”"’)]*)\s+(?=[“"‘(]?[\p{Lu}\p{N}])/u;
const TRAILING = /^[^\s\p{L}\p{N}]+/u;

/** Splits a paragraph into sentences, keeping each sentence's own text. */
export function splitSentencesKeepingText(paragraph: string): string[] {
  return paragraph
    .trim()
    .split(SENTENCE_BREAK)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "the reason something exists" → "The reason something exists." */
export function asSentence(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…]["”’)]*$/u.test(capped) ? capped : `${capped}.`;
}

/** A single-word vocabulary item the student can save (idioms stay plain text here). */
function isSingleWord(item: VocabularyItem): boolean {
  return /^[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*$/u.test(item.word.trim());
}

/** Does a token as written ("resources", "explored") belong to a vocabulary word? */
export function tokenMatches(token: string, word: string): boolean {
  const target = normalizeWordToken(word);
  return baseCandidates(token).some((candidate) => candidate.base === target);
}

interface Hit {
  vocab: number;
  sentence: number;
}

/** First occurrence of each vocabulary word, in reading order. */
function findHits(sentences: string[], vocab: readonly VocabularyItem[]): Hit[] {
  const seen = new Set<number>();
  const hits: Hit[] = [];
  sentences.forEach((sentence, s) => {
    for (const match of sentence.matchAll(WORD_TOKEN)) {
      const v = vocab.findIndex((item, i) => !seen.has(i) && tokenMatches(match[0], item.word));
      if (v >= 0) {
        seen.add(v);
        hits.push({ vocab: v, sentence: s });
      }
    }
  });
  return hits;
}

/** Splits `text` into plain runs and the first occurrence of each chosen word. */
export function tokenizePassage(text: string, words: readonly VocabularyItem[]): { parts: PassagePart[]; used: VocabularyItem[] } {
  const parts: PassagePart[] = [];
  const used: VocabularyItem[] = [];
  const taken = new Set<number>();
  let cursor = 0;
  for (const match of text.matchAll(WORD_TOKEN)) {
    const start = match.index ?? 0;
    if (start < cursor) continue;
    const v = words.findIndex((item, i) => !taken.has(i) && tokenMatches(match[0], item.word));
    if (v < 0) continue;
    taken.add(v);
    used.push(words[v]);
    if (start > cursor) parts.push({ kind: 'text', text: text.slice(cursor, start) });
    const end = start + match[0].length;
    const trailing = TRAILING.exec(text.slice(end))?.[0];
    parts.push(trailing ? { kind: 'word', text: match[0], trailing } : { kind: 'word', text: match[0] });
    cursor = end + (trailing?.length ?? 0);
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) });
  return { parts, used };
}

/**
 * Picks the hero passage: the first paragraph of the Grade 7–8 retelling that
 * holds `count` different vocabulary words (else the one with the most),
 * from one sentence before the first word through the sentence with the last
 * one. Each of those words becomes a tap word with its lesson note.
 */
export function buildHeroDemo(story: DemoStoryInput, count: number = HERO_WORD_COUNT): HeroDemo {
  const level = story.content.levels['7-8'];
  const vocab = story.content.vocabulary.filter((item) => item.band !== '9-10' && isSingleWord(item));
  const paragraphs = level.paragraphs.map(splitSentencesKeepingText);

  let best = { index: 0, hits: [] as Hit[] };
  for (let i = 0; i < paragraphs.length; i++) {
    const hits = findHits(paragraphs[i], vocab);
    if (hits.length > best.hits.length) best = { index: i, hits };
    if (hits.length >= count) break;
  }

  const sentences = paragraphs[best.index] ?? [];
  const chosen = best.hits.slice(0, count);
  const first = chosen[0]?.sentence ?? 0;
  const last = chosen[chosen.length - 1]?.sentence ?? Math.min(1, sentences.length - 1);
  const text = sentences.slice(Math.max(0, first - 1), last + 1).join(' ');
  const { parts, used } = tokenizePassage(
    text,
    chosen.map((hit) => vocab[hit.vocab]),
  );

  const notes: HeroNote[] = used.map((item) => {
    const part = parts.find((p) => p.kind === 'word' && tokenMatches(p.text, item.word));
    return {
      key: (part?.text ?? item.word).toLowerCase(),
      word: item.word.trim(),
      partOfSpeech: item.partOfSpeech || undefined,
      definition: asSentence(item.definition),
      example: item.example ? asSentence(item.example) : undefined,
    };
  });

  return {
    slug: story.slug,
    category: story.category,
    title: level.title,
    minutes: lessonReadingMinutes(story.content, '7-8'),
    passage: parts,
    notes,
  };
}
