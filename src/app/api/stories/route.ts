import { z } from 'zod';

import { CategorySlugSchema } from '@/lib/categories';
import { getDb, isDatabaseUnavailableError } from '@/lib/db';
import { createStoryQueries, decodeCursor, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/stories';

/**
 * `GET /api/stories?category=<slug>&cursor=<opaque>&limit=<1-50>&samples=0|1`
 * (SPEC §8, "Load more" on `/c/[category]`): one page of ready stories,
 * newest news first, then practice stories. Public and CDN-cacheable; the
 * static first page comes from the page itself, this serves the next ones.
 *
 * 200 `{ stories: StorySummary[], nextCursor: string | null }`,
 * 400 `{ error: 'invalid-query' }`, 503 `{ error: 'unavailable' }`.
 */

export const dynamic = 'force-dynamic';

const CACHE_OK = 'public, s-maxage=300, stale-while-revalidate=3600';

const Query = z.object({
  category: CategorySlugSchema.optional(),
  // Only cursors this API issued are accepted, so arbitrary strings cannot fan out into cache entries.
  cursor: z
    .string()
    .max(500)
    .refine((value) => decodeCursor(value) !== null, 'unknown cursor')
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  samples: z.enum(['0', '1']).default('1'),
});

function problem(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = Query.safeParse({
    category: params.get('category') ?? undefined,
    cursor: params.get('cursor') ?? undefined,
    limit: params.get('limit') ?? undefined,
    samples: params.get('samples') ?? undefined,
  });
  if (!query.success) {
    return problem(400, 'invalid-query', 'Use ?category=writing|games|art|sports, a cursor from a previous page and a limit from 1 to 50.');
  }

  try {
    const page = await createStoryQueries(getDb()).listStories({
      category: query.data.category,
      cursor: query.data.cursor,
      limit: query.data.limit,
      includeSamples: query.data.samples === '1',
    });
    return Response.json(page, { headers: { 'Cache-Control': CACHE_OK } });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
    return problem(503, 'unavailable', 'Stories cannot be loaded right now. Try again in a minute.');
  }
}
