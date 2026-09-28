'use server';

import { z } from 'zod';

import type { CardDetails } from './card-details';
import { cardDetailsFor } from './story-details';

/**
 * Cover word and minutes for the cards "Load more" appends on /c/[category].
 * GET /api/stories lists the next page (StorySummary has no lesson data); this
 * read-only Server Function adds the same details the static first page
 * renders, from the cached lessons, so every card on the page looks alike.
 * Public data only; input is validated and capped at one page.
 */
const Slugs = z.array(z.string().min(1).max(200)).max(50);

export async function storyCardDetails(slugs: string[]): Promise<Record<string, CardDetails>> {
  const parsed = Slugs.safeParse(slugs);
  if (!parsed.success) return {};
  return cardDetailsFor(parsed.data);
}
