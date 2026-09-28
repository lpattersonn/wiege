import type { MetadataRoute } from 'next';

import { CATEGORY_SLUGS } from '@/lib/categories';
import { DEFAULT_SITE_URL, siteUrl } from '@/lib/env';
import { listStories, type StorySummary } from '@/lib/stories';

/** Rebuilt with the stories (ISR, 10 minutes); an empty database yields the static pages only. */
export const revalidate = 600;

const MAX_STORIES = 200;

async function recentStories(): Promise<StorySummary[]> {
  const stories: StorySummary[] = [];
  let cursor: string | null = null;
  try {
    do {
      const page = await listStories({ limit: 50, cursor });
      stories.push(...page.stories);
      cursor = page.nextCursor;
    } while (cursor && stories.length < MAX_STORIES);
  } catch (error) {
    console.warn('[sitemap] could not list stories; publishing static pages only', error);
  }
  return stories.slice(0, MAX_STORIES);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let base = DEFAULT_SITE_URL;
  try {
    base = siteUrl();
  } catch {
    // Invalid environment: keep the default origin.
  }
  const stories = await recentStories();
  const newest = stories.find((s) => !s.isSample)?.publishedAt;
  const fresh = newest ? new Date(newest) : undefined;

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'hourly', priority: 1, lastModified: fresh },
    { url: `${base}/today`, changeFrequency: 'hourly', priority: 0.9, lastModified: fresh },
    { url: `${base}/c`, changeFrequency: 'hourly', priority: 0.8, lastModified: fresh },
    ...CATEGORY_SLUGS.map((slug) => ({
      url: `${base}/c/${slug}`,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
      lastModified: fresh,
    })),
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/parents`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const storyPages: MetadataRoute.Sitemap = stories.map((story) => ({
    url: `${base}/read/${encodeURIComponent(story.slug)}`,
    lastModified: new Date(story.publishedAt),
    changeFrequency: story.isSample ? 'monthly' : 'weekly',
    priority: story.isSample ? 0.5 : 0.7,
  }));

  return [...staticPages, ...storyPages];
}
