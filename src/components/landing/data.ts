import 'server-only';

import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/categories';
import { lessonReadingMinutes } from '@/lib/literacy/readability';
import { getLastIngestSummary, getStoryBySlug, getTodaySet, listStories } from '@/lib/stories';

import { countNewToday, distinctSummary, pickCoverWord, pickPreview } from './preview';

/**
 * The landing page's live data (SPEC §8 "/"), read through the cached story
 * queries (tag `stories`, refreshed after every ingest). Every function here
 * returns empty results, never throws, when the database is empty or down, so
 * the page still builds and shows honest empty states.
 */

export interface CategoryPreview {
  category: CategorySlug;
  /** News published in the last 24 hours. */
  newToday: number;
  /** Newest news headline (Grade 7–8 title), if any. */
  latest: string | null;
}

export interface StoryPreview {
  slug: string;
  category: CategorySlug;
  title: string;
  summary: string | null;
  minutes: number | null;
  word: string | null;
  isSample: boolean;
}

export interface LandingData {
  categories: CategoryPreview[];
  stories: StoryPreview[];
  lastSuccessAt: string | null;
}

/** `now` is when this static page is (re)generated: every 10 minutes, and after each ingest. */
export async function getLandingData(now: number = Date.now()): Promise<LandingData> {
  const [lists, todaySet, ingest] = await Promise.all([
    Promise.all(CATEGORY_SLUGS.map((category) => listStories({ category, limit: 50, includeSamples: false }))),
    getTodaySet(),
    getLastIngestSummary(),
  ]);

  const categories = CATEGORY_SLUGS.map((category, i): CategoryPreview => {
    const news = lists[i].stories;
    return { category, newToday: countNewToday(news, now), latest: news[0]?.title ?? null };
  });

  const picked = pickPreview(todaySet, 3);
  const full = await Promise.all(picked.map((s) => getStoryBySlug(s.slug)));
  const stories = picked.map((s, i): StoryPreview => {
    const story = full[i];
    return {
      slug: s.slug,
      category: s.category,
      title: s.title,
      summary: distinctSummary(s.title, s.keyIdea),
      minutes: story ? lessonReadingMinutes(story.content, '7-8') : null,
      word: story ? pickCoverWord(story.content.vocabulary) : null,
      isSample: s.isSample,
    };
  });

  return { categories, stories, lastSuccessAt: ingest?.lastSuccessAt ?? null };
}
