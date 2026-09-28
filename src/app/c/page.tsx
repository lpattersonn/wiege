import type { Metadata } from 'next';

import { countNewToday } from '@/components/explore/card-details';
import { pageMetadata } from '@/components/explore/page-metadata';
import { AppShell } from '@/components/layout/Shells';
import { CategoryGrid, CategoryTile } from '@/components/story/CategoryTile';
import { FreshnessLine } from '@/components/ui/FreshnessLine';
import { CATEGORIES } from '@/lib/categories';
import { getLastIngestSummary, listStories } from '@/lib/stories';

/**
 * /c, Explore (DESIGN §12.3): the four corners, each with its line, how many
 * stories arrived today and the newest headlines. Static, refreshed every
 * 10 minutes and after each ingest.
 */
export const revalidate = 600;

export const metadata: Metadata = pageMetadata({
  title: 'Explore',
  description: 'Four corners of the news: writing, games, art and sport. See what’s new in each today, retold for readers aged 12 to 15.',
  path: '/c',
});

export default async function ExplorePage() {
  const [pages, ingest] = await Promise.all([
    Promise.all(CATEGORIES.map((category) => listStories({ category: category.slug, limit: 50, includeSamples: false }))),
    getLastIngestSummary(),
  ]);
  return (
    <AppShell>
      <header className="mb-10 grid max-w-[760px] gap-3">
        <h1 className="type-h1">Explore</h1>
        <p className="type-lede">Four corners of the news. Pick the one you want to read about and see what’s new today.</p>
      </header>
      <CategoryGrid>
        {CATEGORIES.map((category, i) => (
          <CategoryTile
            key={category.slug}
            category={category.slug}
            newToday={countNewToday(pages[i].stories)}
            latest={pages[i].stories.slice(0, 3).map((story) => story.title)}
            large
            headingLevel="h2"
          />
        ))}
      </CategoryGrid>
      {/* Last on the page: it can wrap to two lines at 320px once the time is filled in. */}
      <FreshnessLine lastSuccessAt={ingest?.lastSuccessAt ?? null} className="mt-10 text-caption! text-ink-3" />
    </AppShell>
  );
}
