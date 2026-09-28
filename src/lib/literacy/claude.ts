import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';

import { aiModel, getAnthropic } from '@/lib/ai/client';
import {
  buildFeedbackUserMessage,
  buildLessonUserMessage,
  FEEDBACK_SYSTEM_PROMPT,
  LESSON_SYSTEM_PROMPT,
  type FeedbackPromptInput,
  type LessonPromptInput,
} from '@/lib/literacy/prompts';
import { LessonContent, lessonContentProblems, WritingFeedback, writingFeedbackProblems } from '@/lib/literacy/types';

/**
 * The Claude path of the literacy engine (SPEC §6): structured outputs via
 * `client.beta.messages.parse` with server-side refusal fallbacks. Every
 * function here resolves to a result object and never throws, so callers can
 * fall back to the heuristic engine on any problem.
 */

export const MAX_OUTPUT_TOKENS = 16000;
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export type AiFailureReason =
  | 'unavailable'
  | 'refusal'
  | 'max_tokens'
  | 'incomplete'
  | 'invalid'
  | 'rate_limited'
  | 'connection'
  | 'api_error'
  | 'unexpected';

export type AiResult<T> =
  | { ok: true; value: T; model: string }
  | { ok: false; reason: AiFailureReason; detail: string };

interface StructuredRequest<S extends z.ZodType> {
  /** For logs only; never include student text. */
  label: string;
  system: string;
  user: string;
  schema: S;
  /** Checks the schema cannot express (counts, ranges). */
  problems?: (value: z.infer<S>) => string[];
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * `betaZodOutputFormat` throws inside the SDK when the text does not parse,
 * which would hide `stop_reason` (a truncated or refused response is not valid
 * JSON). This variant returns null instead, so the stop reason is checked
 * first and the result re-validated afterwards.
 */
function lenientFormat<S extends z.ZodType>(schema: S) {
  const format = betaZodOutputFormat(schema);
  return {
    ...format,
    parse(content: string): z.infer<S> | null {
      try {
        return format.parse(content);
      } catch {
        return null;
      }
    },
  };
}

function fail<T>(reason: AiFailureReason, detail: string): AiResult<T> {
  return { ok: false, reason, detail };
}

function classifyError(error: unknown): { reason: AiFailureReason; detail: string } {
  // Most specific first: RateLimitError and APIConnectionError both extend APIError.
  if (error instanceof Anthropic.RateLimitError) return { reason: 'rate_limited', detail: error.message };
  if (error instanceof Anthropic.APIConnectionError) return { reason: 'connection', detail: error.message };
  if (error instanceof Anthropic.APIError) return { reason: 'api_error', detail: `${error.status ?? 'no status'}: ${error.message}` };
  return { reason: 'unexpected', detail: error instanceof Error ? error.message : String(error) };
}

/** One structured-output call. Resolves to the validated value or a failure reason; never throws. */
export async function requestStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<AiResult<z.infer<S>>> {
  const client = getAnthropic();
  if (!client) return fail('unavailable', 'no Anthropic credentials configured');

  try {
    const response = await client.beta.messages.parse(
      {
        model: aiModel(),
        max_tokens: MAX_OUTPUT_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: lenientFormat(req.schema) },
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: req.user }],
      },
      { timeout: req.timeoutMs, maxRetries: req.maxRetries },
    );

    if (response.stop_reason === 'refusal') {
      return fail('refusal', response.stop_details?.category ?? 'no category');
    }
    if (response.stop_reason === 'max_tokens') return fail('max_tokens', `output reached ${MAX_OUTPUT_TOKENS} tokens`);
    if (response.stop_reason !== 'end_turn' && response.stop_reason !== 'stop_sequence') {
      return fail('incomplete', `stop_reason ${response.stop_reason ?? 'null'}`);
    }

    // With a server-side fallback the served model's text comes last; prefer the last parsed block.
    let parsed: unknown = null;
    for (const block of [...response.content].reverse()) {
      if (block.type === 'text' && block.parsed_output != null) {
        parsed = block.parsed_output;
        break;
      }
    }
    if (parsed === null) return fail('invalid', 'the response did not match the schema');

    const validated = req.schema.safeParse(parsed);
    if (!validated.success) return fail('invalid', validated.error.issues.map((i) => i.message).join('; '));
    const problems = req.problems?.(validated.data) ?? [];
    if (problems.length > 0) return fail('invalid', problems.join('; '));
    return { ok: true, value: validated.data, model: response.model };
  } catch (error) {
    const { reason, detail } = classifyError(error);
    return fail(reason, detail);
  }
}

function logFailure(label: string, result: { reason: AiFailureReason; detail: string }): void {
  if (result.reason === 'unavailable') return;
  console.warn(`[literacy] Claude ${label} failed (${result.reason}): ${result.detail}`);
}

// --- lessons -----------------------------------------------------------------------

/** Article text sent on the first attempt, and on the one retry after `max_tokens`. */
export const LESSON_SOURCE_CHARS = { first: 12_000, retry: 3_000 } as const;

/** Below this, a budgeted retry could not finish, so it is not attempted. */
const MIN_RETRY_MS = 5_000;

/**
 * With `timeoutMs` (a time budget, e.g. a serverless ingest), the whole call,
 * including the one `max_tokens` retry, stays within it: the SDK's own retries
 * are switched off and the retry only gets the time that is left.
 */
export async function claudeLesson(input: LessonPromptInput, opts: { timeoutMs?: number } = {}): Promise<AiResult<LessonContent>> {
  const budgeted = opts.timeoutMs !== undefined;
  const deadline = budgeted ? Date.now() + (opts.timeoutMs ?? 0) : Number.POSITIVE_INFINITY;
  const attempt = (maxSourceChars: number, timeoutMs: number | undefined) =>
    requestStructured({
      label: 'lesson',
      system: LESSON_SYSTEM_PROMPT,
      user: buildLessonUserMessage(input, { maxSourceChars }),
      schema: LessonContent,
      problems: lessonContentProblems,
      timeoutMs,
      maxRetries: budgeted ? 0 : undefined,
    });

  let result = await attempt(LESSON_SOURCE_CHARS.first, opts.timeoutMs);
  if (!result.ok && result.reason === 'max_tokens') {
    const remaining = deadline - Date.now();
    if (!budgeted || remaining >= MIN_RETRY_MS) {
      result = await attempt(LESSON_SOURCE_CHARS.retry, budgeted ? remaining : undefined);
    }
  }
  if (!result.ok) logFailure('lesson', result);
  return result;
}

// --- writing feedback --------------------------------------------------------------

/** The part of the feedback Claude writes; statistics and vocabulary are computed locally. */
export const FeedbackModelOutput = WritingFeedback.pick({ glow: true, grow: true, nextStep: true, rubric: true });
export type FeedbackModelOutput = z.infer<typeof FeedbackModelOutput>;

/** Rounds and clamps rubric scores (a 4.5 or a 0 is a formatting slip, not a reason to discard the feedback). */
function normalizeFeedback(output: FeedbackModelOutput): FeedbackModelOutput {
  const score = (n: number) => (Number.isFinite(n) ? Math.min(4, Math.max(1, Math.round(n))) : 2);
  return {
    glow: output.glow.map((g) => g.trim()).filter(Boolean),
    grow: output.grow.map((g) => g.trim()).filter(Boolean),
    nextStep: output.nextStep.trim(),
    rubric: {
      ideas: score(output.rubric.ideas),
      organization: score(output.rubric.organization),
      wordChoice: score(output.rubric.wordChoice),
      conventions: score(output.rubric.conventions),
    },
  };
}

function feedbackProblems(output: FeedbackModelOutput): string[] {
  const normalized = normalizeFeedback(output);
  const problems = writingFeedbackProblems({
    ...normalized,
    usedVocabulary: [],
    stats: { words: 0, sentences: 0, avgSentenceLength: 0, uniqueWordRatio: 0, longWords: 0 },
    generator: 'claude',
  });
  if (!normalized.nextStep) problems.push('nextStep is empty');
  return problems;
}

/** Feedback is interactive: fail fast and let the student see the offline feedback instead. */
export const FEEDBACK_TIMEOUT_MS = 45_000;

export async function claudeFeedback(input: FeedbackPromptInput): Promise<AiResult<FeedbackModelOutput>> {
  const result = await requestStructured({
    label: 'feedback',
    system: FEEDBACK_SYSTEM_PROMPT,
    user: buildFeedbackUserMessage(input),
    schema: FeedbackModelOutput,
    problems: feedbackProblems,
    timeoutMs: FEEDBACK_TIMEOUT_MS,
    maxRetries: 1,
  });
  if (!result.ok) {
    logFailure('feedback', result);
    return result;
  }
  return { ...result, value: normalizeFeedback(result.value) };
}
