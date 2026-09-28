import type { Definition } from '@/lib/literacy/types';

/**
 * Client for `GET /api/define?w=` (SPEC §8). Found words and unknown words
 * are remembered for the session; rate limits, outages and network errors are
 * not, so trying again later works. Every failure carries a message written
 * for students (the API's own, or ours when there is no answer at all).
 */
export type LookupResult =
  | { status: 'found'; definition: Definition }
  | { status: 'error'; code: 'not-found' | 'invalid-word' | 'rate-limited' | 'unavailable' | 'offline'; message: string };

const cache = new Map<string, LookupResult>();

const OFFLINE: LookupResult = {
  status: 'error',
  code: 'offline',
  message: 'The dictionary can’t be reached. Check your connection, then tap the word again.',
};

function asError(status: number, body: unknown): LookupResult {
  const message = typeof (body as { message?: unknown })?.message === 'string' ? (body as { message: string }).message : null;
  const code = status === 404 ? 'not-found' : status === 400 ? 'invalid-word' : status === 429 ? 'rate-limited' : 'unavailable';
  const fallback =
    code === 'not-found'
      ? 'That word isn’t in the dictionary. Check the spelling, or try another form of the word.'
      : code === 'invalid-word'
        ? 'Look up one word at a time, using letters only.'
        : code === 'rate-limited'
          ? 'That is a lot of lookups in a short time. Wait a minute, then try again.'
          : 'The dictionary is not answering right now. Try again in a minute.';
  return { status: 'error', code, message: message ?? fallback };
}

export async function lookupWord(word: string, signal?: AbortSignal): Promise<LookupResult> {
  const key = word.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  let response: Response;
  try {
    response = await fetch(`/api/define?w=${encodeURIComponent(key)}`, { signal, headers: { accept: 'application/json' } });
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') throw error;
    return OFFLINE;
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const definition = (body as { definition?: Definition } | null)?.definition;
  const result: LookupResult = response.ok && definition ? { status: 'found', definition } : asError(response.status, body);
  if (result.status === 'found' || result.code === 'not-found' || result.code === 'invalid-word') cache.set(key, result);
  return result;
}
