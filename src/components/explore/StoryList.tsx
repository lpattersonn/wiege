'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/categories';
import type { StorySummary } from '@/lib/stories';

import { storyCardDetails } from './actions';
import type { CardDetails } from './card-details';

/**
 * The story list on /c/[category] (DESIGN §12.3). The first 12 cards arrive
 * server-rendered (`news`, `practice`); "Load more stories" appends the next
 * page from GET /api/stories, newest news first and practice stories after,
 * each group in its own grid so practice stories are never mixed into news.
 *
 * The next page (and the card code, loaded on demand) is fetched as the
 * button nears the viewport, so a click usually appends at once. Focus then
 * moves to the first new card, and a polite status line says what happened.
 */
type CardComponent = ComponentType<{ story: StorySummary; details?: CardDetails | null }>;

interface Loaded {
  story: StorySummary;
  details: CardDetails | null;
}

interface NextPage {
  stories: StorySummary[];
  nextCursor: string | null;
  details: Record<string, CardDetails>;
  Card: CardComponent;
}

const GRID = 'grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3';

function isStory(value: unknown): value is StorySummary {
  if (value === null || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.slug === 'string' &&
    typeof s.title === 'string' &&
    typeof s.publishedAt === 'string' &&
    typeof s.isSample === 'boolean' &&
    typeof s.category === 'string' &&
    (CATEGORY_SLUGS as readonly string[]).includes(s.category)
  );
}

async function fetchPage(category: CategorySlug, cursor: string): Promise<NextPage> {
  const url = `/api/stories?category=${encodeURIComponent(category)}&cursor=${encodeURIComponent(cursor)}`;
  const [page, Card] = await Promise.all([
    fetch(url, { headers: { Accept: 'application/json' } }).then(async (res) => {
      if (!res.ok) throw new Error(`stories: HTTP ${res.status}`);
      const body = (await res.json()) as { stories?: unknown; nextCursor?: unknown };
      if (!body || !Array.isArray(body.stories)) throw new Error('stories: unexpected response');
      const stories = body.stories.filter(isStory).map((s) => ({ ...s, keyIdea: typeof s.keyIdea === 'string' ? s.keyIdea : '' }));
      const nextCursor = typeof body.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null;
      // Details are a nicety: without them a card shows its glyph cover and no minutes.
      const details = await storyCardDetails(stories.map((s) => s.slug)).catch(() => ({}) as Record<string, CardDetails>);
      return { stories, nextCursor, details };
    }),
    import('./ExploreStoryCard').then((m) => m.ExploreStoryCard as CardComponent),
  ]);
  return { ...page, Card };
}

export interface StoryListProps {
  category: CategorySlug;
  categoryName: string;
  /** Server-rendered news cards (the static first page). */
  news: ReactNode[];
  /** Server-rendered practice cards from the first page. */
  practice: ReactNode[];
  nextCursor: string | null;
}

export function StoryList({ category, categoryName, news, practice, nextCursor }: StoryListProps) {
  const [more, setMore] = useState<Loaded[]>([]);
  const [cursor, setCursor] = useState(nextCursor);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [announcement, setAnnouncement] = useState('');
  const [Card, setCard] = useState<CardComponent | null>(null);
  const pending = useRef<{ cursor: string; promise: Promise<NextPage> } | null>(null);
  const focusTarget = useRef<{ grid: 'news' | 'practice'; index: number } | null>(null);
  const newsGrid = useRef<HTMLDivElement>(null);
  const practiceGrid = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    (from: string): Promise<NextPage> => {
      if (pending.current?.cursor === from) return pending.current.promise;
      const promise = fetchPage(category, from);
      pending.current = { cursor: from, promise };
      promise.catch(() => {
        if (pending.current?.promise === promise) pending.current = null;
      });
      return promise;
    },
    [category],
  );

  // Fetch ahead when the button comes within ~600px of the viewport.
  useEffect(() => {
    const el = button.current;
    if (!el || !cursor || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load(cursor).catch(() => {});
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, load]);

  // Move focus to the first new card once it is in the DOM.
  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    const grid = target.grid === 'news' ? newsGrid.current : practiceGrid.current;
    grid?.children[target.index]?.querySelector<HTMLAnchorElement>('a[href]')?.focus();
  }, [more]);

  const moreNews = more.filter((item) => !item.story.isSample);
  const morePractice = more.filter((item) => item.story.isSample);
  const newsCount = news.length + moreNews.length;
  const practiceCount = practice.length + morePractice.length;

  async function onLoadMore() {
    if (!cursor || status === 'loading') return;
    setStatus('loading');
    setAnnouncement('');
    try {
      const page = await load(cursor);
      pending.current = null;
      const loaded = page.stories.map((story) => ({ story, details: page.details[story.slug] ?? null }));
      const firstNews = loaded.findIndex((item) => !item.story.isSample);
      focusTarget.current =
        firstNews >= 0 ? { grid: 'news', index: newsCount } : loaded.length ? { grid: 'practice', index: practiceCount } : null;
      setCard(() => page.Card);
      setMore((previous) => [...previous, ...loaded]);
      setCursor(page.nextCursor);
      setStatus('idle');
      const n = loaded.length;
      setAnnouncement(
        `${n} more ${n === 1 ? 'story' : 'stories'} added.${page.nextCursor ? '' : ` That’s every ${categoryName.toLowerCase()} story for now.`}`,
      );
    } catch {
      setStatus('error');
    }
  }

  const loadMore = cursor ? (
    <div className="mt-10 grid justify-items-start gap-3">
      <Button
        ref={button}
        variant="secondary"
        loading={status === 'loading'}
        loadingLabel="Loading…"
        onClick={onLoadMore}
        className="w-full md:w-auto"
      >
        Load more stories
      </Button>
      {status === 'error' ? (
        <p role="alert" className="text-small text-ink">
          Stories didn’t load. Check your connection, then try again.
        </p>
      ) : null}
    </div>
  ) : null;

  const renderMore = (items: Loaded[]) => (Card ? items.map(({ story, details }) => <Card key={story.slug} story={story} details={details} />) : null);

  return (
    <>
      {newsCount > 0 ? (
        <section aria-labelledby="news-h">
          <h2 id="news-h" className="sr-only">
            {categoryName} stories, newest first
          </h2>
          <div ref={newsGrid} className={GRID}>
            {news}
            {renderMore(moreNews)}
          </div>
        </section>
      ) : (
        <p className="max-w-[56ch] text-ui text-ink-2">
          No {categoryName.toLowerCase()} news yet. New stories arrive every four hours.
        </p>
      )}
      {practiceCount === 0 ? loadMore : null}
      {practiceCount > 0 ? (
        <section aria-labelledby="practice-h" className={cx('border-t border-line-soft pt-10', newsCount > 0 ? 'mt-14' : 'mt-10')}>
          <div className="mb-6 grid max-w-[760px] gap-3">
            <h2 id="practice-h" className="type-h3">
              Practice stories
            </h2>
            <p className="type-lede">Written by Wiege for practice. They aren’t news, so they never go out of date.</p>
          </div>
          <div ref={practiceGrid} className={GRID}>
            {practice}
            {renderMore(morePractice)}
          </div>
          {loadMore}
        </section>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
