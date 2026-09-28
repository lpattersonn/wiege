import { WritingFeedback } from '@/lib/literacy/types';
import type { FeedbackInput } from '@/lib/literacy/feedback-core';

/**
 * Client call to `POST /api/feedback` (SPEC §6, BACKEND-NOTES). The server
 * stores nothing. Every answer other than a valid 200 means "keep the instant
 * offline notes"; the API's `message` is written for students, so it is shown
 * as is.
 */

/** The API accepts up to this many characters of writing. */
export const AI_MAX_CHARS = 6000;
/** Below this the API answers 422 without calling the model. */
export const AI_MIN_WORDS = 5;
/** A bit longer than the server's own 45 s model timeout. */
const TIMEOUT_MS = 55_000;

export type AiOutcome = { ok: true; feedback: WritingFeedback } | { ok: false; message: string };

export const OFFLINE_MESSAGE = 'You’re offline, so these are your instant notes. Ask again when you’re back online.';
export const TIMEOUT_MESSAGE = 'The AI notes took too long, so these are your instant notes.';
export const BROKEN_MESSAGE = 'The AI notes didn’t come back complete, so these are your instant notes.';
export const UNAVAILABLE_MESSAGE = 'AI notes aren’t available right now, so these are your instant notes.';
export const NOT_ON_SITE_MESSAGE = 'AI notes aren’t switched on for this site, so these are your instant notes.';

let siteAi: Promise<boolean | null> | null = null;

/**
 * Whether this site has AI notes switched on, from the public /api/health
 * report (asked once per visit, only when a student asks for notes). Null when
 * unknown: then the feedback API itself decides. Skipping the call when AI is
 * off keeps the browser console free of expected 503s.
 */
export function siteHasAi(): Promise<boolean | null> {
  if (!siteAi) {
    siteAi = fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) return null;
        const report = (await res.json()) as { ai?: unknown };
        return typeof report.ai === 'boolean' ? report.ai : null;
      })
      .catch(() => null);
    siteAi.then((value) => {
      if (value === null) siteAi = null;
    });
  }
  return siteAi;
}

function payload(input: FeedbackInput) {
  const seen = new Set<string>();
  const vocabulary = input.vocabulary
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && w.length <= 60 && !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase()))
    .slice(0, 12);
  return {
    prompt: input.prompt.trim().slice(0, 1000),
    text: input.text,
    gradeBand: input.gradeBand,
    vocabulary,
    ...(input.minWords ? { minWords: Math.round(input.minWords) } : {}),
    ...(input.maxWords ? { maxWords: Math.round(input.maxWords) } : {}),
    ...(input.promptKind ? { promptKind: input.promptKind } : {}),
  };
}

/**
 * Requests AI notes. `onResponse` fires when the server has answered (the
 * "Reading for ideas" step); validation of the body is the "Writing notes" step.
 */
export async function requestAiFeedback(input: FeedbackInput, { onResponse, signal }: { onResponse?: () => void; signal?: AbortSignal } = {}): Promise<AiOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  let response: Response;
  try {
    response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(input)),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, message: controller.signal.aborted && !signal?.aborted ? TIMEOUT_MESSAGE : OFFLINE_MESSAGE };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  onResponse?.();
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  const body = (json && typeof json === 'object' ? json : {}) as { feedback?: unknown; message?: unknown };
  if (response.ok) {
    const parsed = WritingFeedback.safeParse(body.feedback);
    return parsed.success ? { ok: true, feedback: parsed.data } : { ok: false, message: BROKEN_MESSAGE };
  }
  return { ok: false, message: typeof body.message === 'string' && body.message.trim() ? body.message : UNAVAILABLE_MESSAGE };
}
