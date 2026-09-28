import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  available: { value: true },
  limitFeedback: vi.fn(),
  getAiWritingFeedback: vi.fn(),
}));

vi.mock('@/lib/ai/client', () => ({ aiAvailable: () => mocks.available.value }));
vi.mock('@/lib/rate-limit', () => ({ limitFeedback: mocks.limitFeedback }));
vi.mock('@/lib/literacy/feedback', () => ({ getAiWritingFeedback: mocks.getAiWritingFeedback }));

const { POST } = await import('./route');

const ORIGIN = 'http://localhost:3000';
const body = {
  prompt: 'Summarise the story in three sentences.',
  text: 'The library lends telescopes now. Families can borrow one for a week. It helps people see the stars.',
  gradeBand: '7-8',
  vocabulary: ['resilient'],
};
const feedback = {
  glow: ['a', 'b'],
  grow: ['c', 'd'],
  nextStep: 'e',
  rubric: { ideas: 3, organization: 3, wordChoice: 2, conventions: 4 },
  usedVocabulary: [],
  stats: { words: 19, sentences: 3, avgSentenceLength: 6.3, uniqueWordRatio: 0.9, longWords: 3 },
  generator: 'claude',
};

function post(payload: unknown, init: { origin?: string | null; contentType?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': init.contentType ?? 'application/json', 'x-real-ip': '198.51.100.4' };
  if (init.origin !== null) headers.origin = init.origin ?? ORIGIN;
  return POST(new Request(`${ORIGIN}/api/feedback`, { method: 'POST', headers, body: init.raw ?? JSON.stringify(payload) }));
}

async function expectFallback(response: Response, status: number, error: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const json = (await response.json()) as { error: string; fallback: string; message: string };
  expect(json).toMatchObject({ error, fallback: 'heuristic' });
  expect(json.message.length).toBeGreaterThan(10);
}

beforeEach(() => {
  mocks.available.value = true;
  mocks.limitFeedback.mockReset().mockResolvedValue({ allowed: true });
  mocks.getAiWritingFeedback.mockReset().mockResolvedValue(feedback);
});

describe('POST /api/feedback', () => {
  it('returns Claude feedback, uncached', async () => {
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ feedback, source: 'claude' });
    expect(mocks.getAiWritingFeedback).toHaveBeenCalledWith(body);
    const [key] = mocks.limitFeedback.mock.calls[0] as [string];
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('passes the optional target range and prompt kind through', async () => {
    await post({ ...body, minWords: 40, maxWords: 90, promptKind: 'summary', extra: 'ignored' });
    expect(mocks.getAiWritingFeedback).toHaveBeenCalledWith({ ...body, minWords: 40, maxWords: 90, promptKind: 'summary' });
  });

  it('rejects cross-site requests before anything else', async () => {
    await expectFallback(await post(body, { origin: 'https://evil.example' }), 403, 'forbidden');
    await expectFallback(await post(body, { origin: null }), 403, 'forbidden');
    expect(mocks.limitFeedback).not.toHaveBeenCalled();
  });

  it('validates the body', async () => {
    await expectFallback(await post(body, { contentType: 'text/plain' }), 415, 'unsupported-media-type');
    await expectFallback(await post(null, { raw: '{not json' }), 400, 'invalid-body');
    await expectFallback(await post({ ...body, gradeBand: '11-12' }), 400, 'invalid-body');
    await expectFallback(await post({ ...body, prompt: '' }), 400, 'invalid-body');
    await expectFallback(await post({ ...body, vocabulary: Array(13).fill('word') }), 400, 'invalid-body');
    await expectFallback(await post({ ...body, text: 'a '.repeat(3001) }), 413, 'too-large');
    await expectFallback(await post(null, { raw: JSON.stringify({ ...body, text: 'x'.repeat(40_000) }) }), 413, 'too-large');
    expect(mocks.limitFeedback).not.toHaveBeenCalled();
  });

  it('does not spend the limit on writing too short to assess, or when AI is off', async () => {
    await expectFallback(await post({ ...body, text: 'Too short.' }), 422, 'too-short');
    mocks.available.value = false;
    await expectFallback(await post(body), 503, 'ai-unavailable');
    expect(mocks.limitFeedback).not.toHaveBeenCalled();
    expect(mocks.getAiWritingFeedback).not.toHaveBeenCalled();
  });

  it('answers 429 with Retry-After over the per-device or daily cap', async () => {
    mocks.limitFeedback.mockResolvedValueOnce({ allowed: false, reason: 'ip', retryAfterSeconds: 3600 });
    const perDevice = await post(body);
    expect(perDevice.headers.get('retry-after')).toBe('3600');
    await expectFallback(perDevice, 429, 'rate-limited');

    mocks.limitFeedback.mockResolvedValueOnce({ allowed: false, reason: 'global', retryAfterSeconds: 100 });
    await expectFallback(await post(body), 429, 'rate-limited');
    expect(mocks.getAiWritingFeedback).not.toHaveBeenCalled();
  });

  it('answers 503 when the limiter is down or Claude fails', async () => {
    mocks.limitFeedback.mockResolvedValueOnce({ allowed: false, reason: 'unavailable', retryAfterSeconds: 60 });
    await expectFallback(await post(body), 503, 'ai-unavailable');

    mocks.getAiWritingFeedback.mockResolvedValueOnce(null);
    await expectFallback(await post(body), 503, 'ai-failed');
  });
});
