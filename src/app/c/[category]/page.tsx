import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ExploreStoryCard } from '@/components/explore/ExploreStoryCard';
import { NewTodayLine } from '@/components/explore/NewTodayLine';
import { pageMetadata } from '@/components/explore/page-metadata';
import { StoryList } from '@/components/explore/StoryList';
import { cardDetailsFor } from '@/components/explore/story-details';
import { countNewToday } from '@/components/explore/card-details';
import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { AppShell } from '@/components/layout/Shells';
import { FreshnessLine } from '@/components/ui/FreshnessLine';
import { CATEGORY_SLUGS, findCategory } from '@/lib/categories';
import { getLastIngestSummary, listStories } from '@/lib/stories';

/**
 * /c/[category] (DESIGN §12.3): the newest ready stories in one corner, 12 on
 * the static page, "Load more" for the rest, practice stories after the news.
 * Static per category, refreshed every 10 minutes and after each ingest.
 */
export const revalidate = 600;
export const dynamicParams = false;

export function generateStaticParams(): Array<{ category: string }> {
  return CATEGORY_SLUGS.map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps<'/c/[category]'>): Promise<Metadata> {
  const category = findCategory((await params).category);
  if (!category) return {};
  return pageMetadata({
    title: `${category.name} news`,
    description: `${category.description} Real news, retold for readers aged 12 to 15, with new stories every four hours.`,
    path: `/c/${category.slug}`,
  });
}

export default async function CategoryPage({ params }: PageProps<'/c/[category]'>) {
  const category = findCategory((await params).category);
  if (!category) notFound();

  const [page, recent, ingest] = await Promise.all([
    listStories({ category: category.slug, limit: 12 }),
    listStories({ category: category.slug, limit: 50, includeSamples: false }),
    getLastIngestSummary(),
  ]);
  const details = await cardDetailsFor(page.stories.map((story) => story.slug));
  const newToday = countNewToday(recent.stories);

  const card = (story: (typeof page.stories)[number]) => <ExploreStoryCard key={story.slug} story={story} details={details[story.slug]} />;

  return (
    <AppShell>
      <div className="grid gap-x-12 @5xl/app:grid-cols-[72px_minmax(0,1fr)]">
        <CategoryGlyph glyph={category.slug} size={72} strokeWidth={2.4} className="hidden @5xl/app:block" />
        <div className="min-w-0">
          <header className="mb-10 grid max-w-[760px] gap-3">
            <div className="flex items-center gap-4">
              <CategoryGlyph glyph={category.slug} size={56} strokeWidth={2.2} className="shrink-0 @5xl/app:hidden" />
              <h1 className="type-h1">{category.name}</h1>
            </div>
            <p className="type-lede">{category.description}</p>
            <NewTodayLine count={newToday} className="mt-1" />
          </header>
          <StoryList
            category={category.slug}
            categoryName={category.name}
            news={page.stories.filter((story) => !story.isSample).map(card)}
            practice={page.stories.filter((story) => story.isSample).map(card)}
            nextCursor={page.nextCursor}
          />
          {/* Last on the page: it can wrap to two lines at 320px once the time is filled in. */}
          <FreshnessLine lastSuccessAt={ingest?.lastSuccessAt ?? null} className="mt-12 text-caption! text-ink-3" />
        </div>
      </div>
    </AppShell>
  );
}
