import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { heuristicLesson } from './heuristic';
import type { LessonContent } from './types';

const mocks = vi.hoisted(() => ({ parse: vi.fn(), enabled: { value: true } }));

vi.mock('@/lib/ai/client', () => ({
  getAnthropic: () => (mocks.enabled.value ? { beta: { messages: { parse: mocks.parse } } } : null),
  aiAvailable: () => mocks.enabled.value,
  aiModel: () => 'claude-opus-5',
}));

const { claudeFeedback, claudeLesson, FALLBACK_BETA, LESSON_SOURCE_CHARS, MAX_OUTPUT_TOKENS } = await import('./claude');
const { FEEDBACK_SYSTEM_PROMPT, LESSON_SYSTEM_PROMPT } = await import('./prompts');

interface FakeParams {
  model: string;
  max_tokens: number;
  betas: string[];
  fallbacks: unknown;
  output_config: { effort: string; format: { type: string; schema: unknown; parse(text: string): unknown } };
  system: Array<{ type: string; text: string }>;
  messages: Array<{ role: string; content: string }>;
  [key: string]: unknown;
}

/** Simulates the SDK: runs the request's output format parser over `text`, like `messages.parse` does. */
function respond(text: string, stopReason = 'end_turn', model = 'claude-opus-5') {
  mocks.parse.mockImplementationOnce(async (params: FakeParams) => {
    const parsed = params.output_config.format.parse(text);
    return {
      model,
      stop_reason: stopReason,
      stop_details: stopReason === 'refusal' ? { type: 'refusal', category: 'cyber', explanation: null } : null,
      content: text ? [{ type: 'text', text, parsed_output: parsed }] : [],
      parsed_output: parsed,
    };
  });
}

const lesson: LessonContent = heuristicLesson({
  title: 'Library lends telescopes to families',
  excerpt: 'A town library now lends telescopes. Families can borrow one for a week and return it with a star diary.',
  category: 'writing',
  sourceName: 'Example News',
  url: 'https://example.com/telescopes',
});

const source = {
  title: 'Library lends telescopes to families',
  excerpt: 'A town library now lends telescopes.',
  fullText: 'Full text. '.repeat(2000),
  category: 'writing' as const,
  sourceName: 'Example News',
};

beforeEach(() => {
  mocks.parse.mockReset();
  mocks.enabled.value = true;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('claudeLesson', () => {
  it('sends a structured-output request with server-side fallbacks and a stable system prompt', async () => {
    respond(JSON.stringify(lesson));
    const result = await claudeLesson(source);
    expect(result).toEqual({ ok: true, value: lesson, model: 'claude-opus-5' });

    const [params] = mocks.parse.mock.calls[0] as [FakeParams];
    expect(params).toMatchObject({
      model: 'claude-opus-5',
      max_tokens: MAX_OUTPUT_TOKENS,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
    });
    expect(params.system).toEqual([{ type: 'text', text: LESSON_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }]);
    for (const banned of ['temperature', 'top_p', 'top_k', 'thinking']) expect(params).not.toHaveProperty(banned);
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0].role).toBe('user');
    expect(params.messages[0].content).toMatch(/<article>[\s\S]*<\/article>/);
    expect(params.messages[0].content.length).toBeLessThan(LESSON_SOURCE_CHARS.first + 1000);
  });

  it('reports the model that actually served the request', async () => {
    respond(JSON.stringify(lesson), 'end_turn', 'claude-opus-4-8');
    const result = await claudeLesson(source);
    expect(result.ok && result.model).toBe('claude-opus-4-8');
  });

  it('treats a refusal as a failure without reading the content', async () => {
    respond('', 'refusal');
    expect(await claudeLesson(source)).toEqual({ ok: false, reason: 'refusal', detail: 'cyber' });
  });

  it('retries once with a trimmed source after max_tokens', async () => {
    respond('{"keyIdea": "trunc', 'max_tokens');
    respond(JSON.stringify(lesson));
    const result = await claudeLesson(source);
    expect(result.ok).toBe(true);
    expect(mocks.parse).toHaveBeenCalledTimes(2);
    const retry = (mocks.parse.mock.calls[1] as [FakeParams])[0].messages[0].content;
    expect(retry).toContain('shortened');
    expect(retry.length).toBeLessThan(LESSON_SOURCE_CHARS.retry + 1000);
  });

  it('keeps a time budget: no SDK retries, and no max_tokens retry without enough time left', async () => {
    respond(JSON.stringify(lesson));
    await claudeLesson(source, { timeoutMs: 20_000 });
    expect(mocks.parse.mock.calls[0][1]).toEqual({ timeout: 20_000, maxRetries: 0 });

    mocks.parse.mockReset();
    respond('{', 'max_tokens');
    expect(await claudeLesson(source, { timeoutMs: 1_000 })).toMatchObject({ ok: false, reason: 'max_tokens' });
    expect(mocks.parse).toHaveBeenCalledTimes(1);

    mocks.parse.mockReset();
    respond('{', 'max_tokens');
    respond(JSON.stringify(lesson));
    expect((await claudeLesson(source, { timeoutMs: 60_000 })).ok).toBe(true);
    const retryOptions = mocks.parse.mock.calls[1][1] as { timeout: number; maxRetries: number };
    expect(retryOptions.maxRetries).toBe(0);
    expect(retryOptions.timeout).toBeLessThanOrEqual(60_000);
    expect(retryOptions.timeout).toBeGreaterThan(50_000);
  });

  it('gives up after a second max_tokens', async () => {
    respond('{', 'max_tokens');
    respond('{', 'max_tokens');
    expect(await claudeLesson(source)).toMatchObject({ ok: false, reason: 'max_tokens' });
    expect(mocks.parse).toHaveBeenCalledTimes(2);
  });

  it('rejects output that does not parse or is incomplete', async () => {
    respond('not json');
    expect(await claudeLesson(source)).toMatchObject({ ok: false, reason: 'invalid' });

    respond(JSON.stringify({ ...lesson, quiz: lesson.quiz.slice(0, 4) }));
    expect(await claudeLesson(source)).toMatchObject({ ok: false, reason: 'invalid', detail: expect.stringContaining('quiz has 4 questions') });

    respond(JSON.stringify({ ...lesson, quiz: [{ ...lesson.quiz[0], skill: 'guessing' }] }));
    expect(await claudeLesson(source)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('maps SDK errors, most specific first, and never throws', async () => {
    const cases: Array<[unknown, string]> = [
      [new Anthropic.RateLimitError(429, undefined, 'slow down', new Headers()), 'rate_limited'],
      [new Anthropic.APIConnectionTimeoutError({ message: 'timed out' }), 'connection'],
      [new Anthropic.APIConnectionError({ message: 'offline' }), 'connection'],
      [new Anthropic.InternalServerError(500, undefined, 'boom', new Headers()), 'api_error'],
      [new Anthropic.BadRequestError(400, undefined, 'bad', new Headers()), 'api_error'],
      [new Error('surprise'), 'unexpected'],
    ];
    for (const [error, reason] of cases) {
      mocks.parse.mockRejectedValueOnce(error);
      expect(await claudeLesson(source)).toMatchObject({ ok: false, reason });
    }
  });

  it('is unavailable without a client', async () => {
    mocks.enabled.value = false;
    expect(await claudeLesson(source)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(mocks.parse).not.toHaveBeenCalled();
  });
});

describe('claudeFeedback', () => {
  const input = { prompt: 'Summarise the story.', text: 'The library lends telescopes now.', gradeBand: '7-8' as const, vocabulary: [], words: 5, sentences: 1 };
  const output = {
    glow: ['Your opening "The library lends telescopes" is clear.', 'You kept it short.'],
    grow: ['Add who can borrow them.', 'Say why it matters.'],
    nextStep: 'Add one sentence about who can borrow a telescope.',
    rubric: { ideas: 2.6, organization: 0, wordChoice: 5, conventions: 3 },
  };

  it('uses the feedback prompt, a short timeout and one retry, and normalises the rubric', async () => {
    respond(JSON.stringify(output));
    const result = await claudeFeedback(input);
    expect(result).toEqual({
      ok: true,
      model: 'claude-opus-5',
      value: { ...output, rubric: { ideas: 3, organization: 1, wordChoice: 4, conventions: 3 } },
    });
    const [params, options] = mocks.parse.mock.calls[0] as [FakeParams, { timeout: number; maxRetries: number }];
    expect(params.system[0].text).toBe(FEEDBACK_SYSTEM_PROMPT);
    expect(params.messages[0].content).toContain('<student_writing>\nThe library lends telescopes now.\n</student_writing>');
    expect(options).toEqual({ timeout: 45_000, maxRetries: 1 });
  });

  it('rejects feedback with the wrong number of glows or grows', async () => {
    respond(JSON.stringify({ ...output, glow: ['only one'] }));
    expect(await claudeFeedback(input)).toMatchObject({ ok: false, reason: 'invalid' });
  });
});
