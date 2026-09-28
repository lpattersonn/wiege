import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ lookupDefinition: vi.fn(), limitDefine: vi.fn() }));

vi.mock('@/lib/dictionary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dictionary')>()),
  lookupDefinition: mocks.lookupDefinition,
}));
vi.mock('@/lib/rate-limit', () => ({ limitDefine: mocks.limitDefine }));

const { GET } = await import('./route');

const definition = { word: 'curious', meanings: [{ partOfSpeech: 'adjective', definitions: [{ definition: 'Eager to learn.' }] }] };

function get(query: string, headers: Record<string, string> = {}) {
  return GET(new Request(`http://localhost:3000/api/define${query}`, { headers: { 'x-real-ip': '203.0.113.7', ...headers } }));
}

beforeEach(() => {
  mocks.lookupDefinition.mockReset();
  mocks.limitDefine.mockReset().mockResolvedValue({ allowed: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/define', () => {
  it('returns a CDN-cacheable definition', async () => {
    mocks.lookupDefinition.mockResolvedValueOnce({ status: 'found', definition });
    const response = await get('?w=Curious');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
    expect(await response.json()).toEqual({ definition });
    expect(mocks.lookupDefinition).toHaveBeenCalledWith('curious');
  });

  it('limits per salted IP hash, never the raw IP', async () => {
    mocks.lookupDefinition.mockResolvedValueOnce({ status: 'found', definition });
    await get('?w=curious');
    const [key] = mocks.limitDefine.mock.calls[0] as [string];
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('203.0.113.7');
  });

  it('validates the word before doing any work', async () => {
    for (const query of ['', '?w=', '?w=two%20words', `?w=${'a'.repeat(41)}`, '?w=%3Cscript%3E', '?w=abc1']) {
      const response = await get(query);
      expect(response.status, query).toBe(400);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toMatchObject({ error: 'invalid-word' });
    }
    expect(mocks.limitDefine).not.toHaveBeenCalled();
    expect(mocks.lookupDefinition).not.toHaveBeenCalled();
  });

  it('answers 404 JSON for unknown words', async () => {
    mocks.lookupDefinition.mockResolvedValueOnce({ status: 'not-found' });
    const response = await get('?w=zzyzx');
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toMatch(/^public, s-maxage=3600/);
    expect(await response.json()).toMatchObject({ error: 'not-found' });
  });

  it('answers 429 with Retry-After when over the limit', async () => {
    mocks.limitDefine.mockResolvedValueOnce({ allowed: false, reason: 'ip', retryAfterSeconds: 42 });
    const response = await get('?w=curious');
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.lookupDefinition).not.toHaveBeenCalled();
  });

  it('answers 503 when the dictionary is unreachable, and keeps working if the limiter fails', async () => {
    mocks.limitDefine.mockRejectedValueOnce(new Error('limiter broke'));
    mocks.lookupDefinition.mockResolvedValueOnce({ status: 'unavailable' });
    const response = await get('?w=curious');
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
