import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';

import { STORIES_TAG } from '@/lib/stories';

/**
 * Pages that list or show stories (SPEC §5 step 6).
 *
 * The `stories` tag is the primary mechanism: every story query is cached
 * with it (lib/stories.ts), and Next.js adds the tags of the data a page used
 * to that page's cache entry, so marking the tag stale refreshes every page
 * that shows stories wherever its file lives. With the recommended `max`
 * profile the next visitor gets the cached page while it regenerates in the
 * background, and a regenerating page always waits for fresh data.
 *
 * The paths are belt and braces for pages that render stories without going
 * through the tagged queries. Dynamic segments need the route pattern plus
 * `'page'`; if these pages move into a route group, the pattern must include
 * it (e.g. `/(app)/read/[slug]`), while literal paths are URL paths.
 */
export const STORY_PAGE_PATHS: ReadonlyArray<{ path: string; type?: 'page' | 'layout' }> = [
  { path: '/' },
  { path: '/today' },
  { path: '/c' },
  { path: '/c/[category]', type: 'page' },
  { path: '/read/[slug]', type: 'page' },
];

/**
 * Marks every page that reads stories as stale. Works inside a Next.js route
 * handler or server action; elsewhere (CLI, the in-process scheduler) Next.js
 * has no request store, so this returns false and pages refresh through
 * time-based ISR (10 minutes) or a POST to `/api/cron/ingest?revalidateOnly=1`.
 */
export function revalidateStoryPages(opts: { expireNow?: boolean } = {}): boolean {
  try {
    revalidateTag(STORIES_TAG, opts.expireNow ? { expire: 0 } : 'max');
    for (const { path, type } of STORY_PAGE_PATHS) revalidatePath(path, type);
    return true;
  } catch (error) {
    console.warn(
      `[ingest] story pages were not revalidated (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`,
    );
    return false;
  }
}
