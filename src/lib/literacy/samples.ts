import type { CategorySlug } from '@/lib/categories';
import { ART_PRACTICE } from '@/lib/literacy/practice-art';
import { GAMES_PRACTICE } from '@/lib/literacy/practice-games';
import { SPORTS_PRACTICE } from '@/lib/literacy/practice-sports';
import { WRITING_PRACTICE } from '@/lib/literacy/practice-writing';
import type { LessonContent } from '@/lib/literacy/types';

/**
 * Practice stories (SPEC §6): twelve hand-written, evergreen explainers, three
 * per category, each with a complete lesson at both reading levels. They are
 * the first thing a new student reads, are always labelled "Practice story"
 * and are never presented as news. Pure data (no server-only imports), so the
 * landing page can import the demo story statically.
 */

export interface PracticeStory {
  /** Stable, starts with `practice-`. */
  slug: string;
  category: CategorySlug;
  /** Stored as the article title. */
  title: string;
  /** Plain text, at most 600 characters. */
  excerpt: string;
  /** Fixed ISO timestamp so ordering never changes between seeds. */
  publishedAt: string;
  content: LessonContent;
}

export const PRACTICE_SOURCE = {
  id: 'wiege-practice',
  name: 'Wiege practice',
  /** Never fetched: the source is disabled so ingestion skips it. */
  feedUrl: 'wiege:practice',
  homepage: '/about',
  category: 'writing',
} as const satisfies { id: string; name: string; feedUrl: string; homepage: string; category: CategorySlug };

export const PRACTICE_STORIES: readonly PracticeStory[] = [...WRITING_PRACTICE, ...GAMES_PRACTICE, ...ART_PRACTICE, ...SPORTS_PRACTICE];

const LANDING_DEMO_SLUG = 'practice-libraries-lend-more';

export function getPracticeStory(slug: string): PracticeStory | undefined {
  return PRACTICE_STORIES.find((story) => story.slug === slug);
}

/** The story behind the landing page's tap-a-word demo (static; no database). */
export function getLandingDemoStory(): { slug: string; category: CategorySlug; content: LessonContent } {
  const story = getPracticeStory(LANDING_DEMO_SLUG) ?? PRACTICE_STORIES[0];
  return { slug: story.slug, category: story.category, content: story.content };
}
