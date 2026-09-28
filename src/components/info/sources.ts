import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/categories';
import { FEEDS, type FeedDefinition } from '@/lib/news/feeds';

/**
 * The curated news sources as /parents lists them, derived from `FEEDS` (the
 * same list the ingester fetches), so the page can never drift from the code.
 * Pure and isomorphic.
 */

export interface SourceSummary {
  id: string;
  name: string;
  homepage: string;
  /** Display host, e.g. "bbc.co.uk" (no "www."). */
  host: string;
  /** Every category this source can feed, in the site's category order. */
  categories: CategorySlug[];
  why: string;
}

const categoryOrder = (slug: CategorySlug) => CATEGORY_SLUGS.indexOf(slug);

/** The categories a feed's stories can land in: its own for fixed feeds, the routed set for keyword feeds. */
export function feedCategories(feed: Pick<FeedDefinition, 'category' | 'routing'>): CategorySlug[] {
  const slugs = feed.routing.kind === 'fixed' ? [feed.category] : [...new Set(feed.routing.categories)];
  return slugs.sort((a, b) => categoryOrder(a) - categoryOrder(b));
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Sources grouped by their main category (Writing, Games, Art, Sports), keeping list order within each. */
export function sourceSummaries(feeds: readonly FeedDefinition[] = FEEDS): SourceSummary[] {
  return feeds
    .map((feed, index) => ({ feed, index }))
    .sort((a, b) => categoryOrder(a.feed.category) - categoryOrder(b.feed.category) || a.index - b.index)
    .map(({ feed }) => ({
      id: feed.id,
      name: feed.name,
      homepage: feed.homepage,
      host: displayHost(feed.homepage),
      categories: feedCategories(feed),
      why: feed.why,
    }));
}
