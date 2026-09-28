import type { LessonContent } from '@/lib/literacy/types';

/**
 * Pure helpers for the story cards on Today and Explore. Isomorphic (no
 * server-only imports), so they are unit-testable and safe anywhere.
 */

/** What a card needs beyond the list's StorySummary. */
export interface CardDetails {
  /** Cover key word (DESIGN §8.9), or null for the glyph cover. */
  word: string | null;
  /** Reading minutes at Grade 7–8 (the default level). */
  minutes: number | null;
  /** Vocabulary words taught at Grade 7–8. */
  newWords: number;
}

const COVER_WORD = /^[\p{L}][\p{L}'’-]{0,11}$/u;

/**
 * The story's key vocabulary word for its cover: the first Grade 7–8 word
 * that fits a cover (one word, ≤ 12 letters), else the first one at any
 * level, else null (the cover falls back to the category glyph).
 */
export function keyWord(content: Pick<LessonContent, 'vocabulary'>): string | null {
  const fits = (word: string) => COVER_WORD.test(word.trim());
  const junior = content.vocabulary.find((item) => item.band !== '9-10' && fits(item.word));
  const any = junior ?? content.vocabulary.find((item) => fits(item.word));
  return any ? any.word.trim() : null;
}

/** Vocabulary words a Grade 7–8 reader meets in the story. */
export function juniorWordCount(content: Pick<LessonContent, 'vocabulary'>): number {
  return content.vocabulary.filter((item) => item.band !== '9-10').length;
}

/** Stories count as "new today" for 24 hours after they were published. */
export const NEW_TODAY_WINDOW_MS = 24 * 3_600_000;

/** News (never practice stories) published in the 24 hours before `now` (default: the render time). */
export function countNewToday(stories: ReadonlyArray<{ publishedAt: string; isSample: boolean }>, now: number = Date.now()): number {
  let n = 0;
  for (const story of stories) {
    if (story.isSample) continue;
    const at = Date.parse(story.publishedAt);
    if (!Number.isNaN(at) && now - at <= NEW_TODAY_WINDOW_MS && at <= now + 5 * 60_000) n++;
  }
  return n;
}
