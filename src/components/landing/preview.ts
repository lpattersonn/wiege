import { DAY_MS } from '@/lib/time';

/**
 * Pure helpers for the landing page's live sections (categories and today's
 * stories). Kept apart from the database calls so they can be tested.
 */

interface Dated {
  publishedAt: string;
  isSample: boolean;
}

/** "N new today": news (never practice stories) published in the 24 hours before `now`. */
export function countNewToday(stories: readonly Dated[], now: number): number {
  const since = now - DAY_MS;
  return stories.filter((s) => {
    const at = Date.parse(s.publishedAt);
    return !s.isSample && Number.isFinite(at) && at > since && at <= now + 60_000;
  }).length;
}

/**
 * The stories to preview: newest news first, practice stories only to fill
 * the row when there isn't enough news yet.
 */
export function pickPreview<T extends Dated>(stories: readonly T[], count = 3): T[] {
  const news = stories.filter((s) => !s.isSample).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const practice = stories.filter((s) => s.isSample);
  return [...news, ...practice].slice(0, count);
}

/** The cover word: the first vocabulary word that fits a cover (one word, at most 12 letters). */
export function pickCoverWord(vocabulary: ReadonlyArray<{ word: string }>): string | null {
  for (const { word } of vocabulary) {
    const w = word.trim();
    if (/^[\p{L}][\p{L}'’-]{0,11}$/u.test(w)) return w;
  }
  return null;
}

const comparable = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** The card summary, or null when it only repeats the headline (some offline lessons do). */
export function distinctSummary(title: string, summary: string): string | null {
  const s = comparable(summary);
  if (!s) return null;
  return s.startsWith(comparable(title)) ? null : summary.trim();
}
