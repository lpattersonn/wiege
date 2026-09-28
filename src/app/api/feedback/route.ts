import { z } from 'zod';

import { aiAvailable } from '@/lib/ai/client';
import { getAiWritingFeedback } from '@/lib/literacy/feedback';
import { GradeBand, WRITING_PROMPT_KINDS } from '@/lib/literacy/types';
import { countWords } from '@/lib/progress/text';
import { limitFeedback } from '@/lib/rate-limit';
import { clientKey, isSameOriginRequest, readBodyCapped } from '@/lib/request';

/**
 * `POST /api/feedback` (SPEC §6): AI writing feedback from Claude. Stateless:
 * the writing is used for this one response and never stored or logged.
 *
 * 200 `{ feedback, source: 'claude' }`. Every other answer is JSON
 * `{ error, message, fallback: 'heuristic' }` telling the client to show its
 * instant offline feedback instead: 400 invalid body, 403 cross-site, 413 too
 * large, 415 not JSON, 422 too short to assess, 429 over the per-device or
 * daily limit (with `Retry-After`), 503 AI unavailable or failed.
 */

export const dynamic = 'force-dynamic';
/** A Claude call can take tens of seconds; hosts that honour this give it room. */
export const maxDuration = 60;

const MAX_TEXT_CHARS = 6000;
const MAX_BODY_CHARS = 32 * 1024;
/** UTF-8 can take up to 4 bytes per character; the character limit above is checked after decoding. */
const MAX_BODY_BYTES = 4 * MAX_BODY_CHARS;
/** Below this there is nothing for Claude to assess, so no AI call (and no rate-limit hit) is made. */
const MIN_WORDS_FOR_AI = 5;

const Body = z.object({
  prompt: z.string().trim().min(1).max(1000),
  text: z.string().max(MAX_TEXT_CHARS),
  gradeBand: GradeBand,
  vocabulary: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  minWords: z.number().int().positive().max(5000).optional(),
  maxWords: z.number().int().positive().max(5000).optional(),
  promptKind: z.enum([...WRITING_PROMPT_KINDS, 'free']).optional(),
});

function fallback(status: number, error: string, message: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error, message, fallback: 'heuristic' }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return fallback(403, 'forbidden', 'Feedback can only be requested from Wiege itself.');
  }
  if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '')) {
    return fallback(415, 'unsupported-media-type', 'Send the writing as JSON.');
  }
  let raw: string | null;
  try {
    raw = await readBodyCapped(request, MAX_BODY_BYTES);
  } catch {
    return fallback(400, 'invalid-body', 'The request could not be read.');
  }
  if (raw === null || raw.length > MAX_BODY_CHARS) {
    return fallback(413, 'too-large', `Feedback works on up to ${MAX_TEXT_CHARS} characters of writing.`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fallback(400, 'invalid-body', 'The request was not valid JSON.');
  }
  const body = Body.safeParse(json);
  if (!body.success) {
    const tooLong = body.error.issues.some((issue) => issue.path[0] === 'text' && issue.code === 'too_big');
    return tooLong
      ? fallback(413, 'too-large', `Feedback works on up to ${MAX_TEXT_CHARS} characters of writing.`)
      : fallback(400, 'invalid-body', 'The request was missing the prompt, the writing or the grade band.');
  }

  if (countWords(body.data.text) < MIN_WORDS_FOR_AI) {
    return fallback(422, 'too-short', 'Write a few sentences first, then ask for feedback.');
  }
  if (!aiAvailable()) {
    return fallback(503, 'ai-unavailable', 'AI feedback is not switched on for this site, so here is your instant feedback.');
  }

  const limit = await limitFeedback(clientKey(request.headers));
  if (!limit.allowed) {
    if (limit.reason === 'unavailable') {
      return fallback(503, 'ai-unavailable', 'AI feedback is not available right now, so here is your instant feedback.');
    }
    const message =
      limit.reason === 'ip'
        ? 'This device has used today’s AI feedback. Here is your instant feedback; AI feedback will be back tomorrow.'
        : 'Wiege has used today’s AI feedback for everyone. Here is your instant feedback; AI feedback will be back tomorrow.';
    return fallback(429, 'rate-limited', message, { 'Retry-After': String(limit.retryAfterSeconds) });
  }

  const feedback = await getAiWritingFeedback(body.data);
  if (!feedback) {
    return fallback(503, 'ai-failed', 'AI feedback did not work this time, so here is your instant feedback.');
  }
  return Response.json({ feedback, source: 'claude' }, { headers: { 'Cache-Control': 'no-store' } });
}
