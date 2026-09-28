import { z } from 'zod';

import { lookupDefinition, MAX_WORD_LENGTH, normalizeLookupWord } from '@/lib/dictionary';
import { limitDefine } from '@/lib/rate-limit';
import { clientKey } from '@/lib/request';

/**
 * `GET /api/define?w=<word>` (SPEC §8): a kid-safe dictionary definition for
 * one word. Public and CDN-cacheable; rate-limited per salted IP hash (120 per
 * minute). Responses: 200 `{ definition }`, 400 invalid word, 404 unknown
 * word, 429 too many lookups, 503 dictionary unreachable.
 */

export const dynamic = 'force-dynamic';

const Query = z.object({
  w: z
    .string()
    .trim()
    .min(1)
    .max(MAX_WORD_LENGTH)
    .transform((value, ctx) => {
      const word = normalizeLookupWord(value);
      if (!word) {
        ctx.addIssue({ code: 'custom', message: 'not a single word' });
        return z.NEVER;
      }
      return word;
    }),
});

const CACHE_FOUND = 'public, s-maxage=86400, stale-while-revalidate=604800';
const CACHE_NOT_FOUND = 'public, s-maxage=3600, stale-while-revalidate=86400';

function problem(status: number, error: string, message: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error, message }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function GET(request: Request): Promise<Response> {
  const query = Query.safeParse({ w: new URL(request.url).searchParams.get('w') ?? '' });
  if (!query.success) {
    return problem(400, 'invalid-word', `Send one word of up to ${MAX_WORD_LENGTH} letters, for example ?w=curious.`);
  }
  const word = query.data.w;

  try {
    const limit = await limitDefine(clientKey(request.headers));
    if (!limit.allowed) {
      return problem(429, 'rate-limited', 'That is a lot of lookups in a short time. Wait a minute, then try again.', {
        'Retry-After': String(limit.retryAfterSeconds),
      });
    }
  } catch (error) {
    // Lookups are cheap and cached; a limiter fault should not stop students reading.
    console.error('[api/define] rate limiter failed; allowing the lookup', error);
  }

  const result = await lookupDefinition(word);
  if (result.status === 'found') {
    return Response.json({ definition: result.definition }, { headers: { 'Cache-Control': CACHE_FOUND } });
  }
  if (result.status === 'not-found') {
    return Response.json(
      { error: 'not-found', message: `We could not find "${word}" in the dictionary. Check the spelling, or try another form of the word.` },
      { status: 404, headers: { 'Cache-Control': CACHE_NOT_FOUND } },
    );
  }
  return problem(503, 'unavailable', 'The dictionary is not answering right now. Try again in a minute.', { 'Retry-After': '60' });
}
