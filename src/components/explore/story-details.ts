import 'server-only';

import { lessonReadingMinutes } from '@/lib/literacy/readability';
import { getStoryBySlug, isPlausibleSlug } from '@/lib/stories';

import { juniorWordCount, keyWord, type CardDetails } from './card-details';

/**
 * Server-side card details (cover word, minutes, new words) from the cached
 * lesson. Missing or unreadable stories yield null, never an error: the card
 * then shows the glyph cover and no minutes.
 */
export async function cardDetails(slug: string): Promise<CardDetails | null> {
  if (!isPlausibleSlug(slug)) return null;
  try {
    const story = await getStoryBySlug(slug);
    if (!story) return null;
    return {
      word: keyWord(story.content),
      minutes: lessonReadingMinutes(story.content, '7-8'),
      newWords: juniorWordCount(story.content),
    };
  } catch (error) {
    console.warn(`[explore] could not load details for "${slug}"`, error);
    return null;
  }
}

/** Details for many slugs at once, keyed by slug (missing ones left out). */
export async function cardDetailsFor(slugs: readonly string[]): Promise<Record<string, CardDetails>> {
  const unique = [...new Set(slugs)];
  const details = await Promise.all(unique.map((slug) => cardDetails(slug)));
  const out: Record<string, CardDetails> = {};
  unique.forEach((slug, i) => {
    const d = details[i];
    if (d) out[slug] = d;
  });
  return out;
}
