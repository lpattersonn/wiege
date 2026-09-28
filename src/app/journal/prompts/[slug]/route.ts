import { getStoryBySlug, isPlausibleSlug } from '@/lib/stories';

import type { StoryKit } from '@/components/journal/story-kit';

/**
 * `GET /journal/prompts/<slug>`: a story's writing kit for the journal pages
 * (the three prompts, the vocabulary words and both titles). Public story data
 * only, CDN-cacheable like the story itself. The journal pages are static
 * shells, so they fetch this when an entry belongs to a story.
 *
 * 200 StoryKit · 404 `{ error: 'not-found', message }` · 400 bad slug.
 */

const CACHE_OK = 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400';

function problem(status: number, error: string, message: string, cache = 'no-store'): Response {
  return Response.json({ error, message }, { status, headers: { 'Cache-Control': cache } });
}

export async function GET(_request: Request, { params }: RouteContext<'/journal/prompts/[slug]'>): Promise<Response> {
  const { slug } = await params;
  if (!isPlausibleSlug(slug)) return problem(400, 'invalid-slug', 'That doesn’t look like a story link.');
  const story = await getStoryBySlug(slug);
  if (!story) return problem(404, 'not-found', 'This story has moved on, so its prompts aren’t available any more.', 'public, s-maxage=300');
  const kit: StoryKit = {
    slug: story.slug,
    category: story.category,
    titles: story.titles,
    isSample: story.isSample,
    vocabulary: story.content.vocabulary.map((v) => ({ word: v.word, band: v.band })),
    prompts: story.content.writingPrompts.map((p) => ({
      id: p.id,
      kind: p.kind,
      prompt: p.prompt,
      minWords: p.minWords,
      maxWords: p.maxWords,
      tips: p.tips,
    })),
  };
  return Response.json(kit, { headers: { 'Cache-Control': CACHE_OK } });
}
