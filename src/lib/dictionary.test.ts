import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { definitions } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';

import { define, lookupDefinition, NEGATIVE_CACHE_MS, normalizeEntries, normalizeLookupWord, type FetchLike } from './dictionary';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.truncateAll();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const ENTRY = {
  word: 'curious',
  phonetic: '/ˈkjʊəɹiəs/',
  phonetics: [
    { text: '/ˈkjʊəɹiəs/', audio: '' },
    { audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/curious-us.mp3' },
    { audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/curious-uk.mp3' },
  ],
  meanings: [
    {
      partOfSpeech: 'adjective',
      definitions: [
        { definition: 'Tending to ask questions, investigate, or explore.', example: 'A curious child.', synonyms: [] },
        { definition: '(slang) Something a student should not see.' },
        { definition: 'Unusual; odd; weird.' },
        { definition: 'Careful.' },
        { definition: 'Fourth sense is dropped by the cap.' },
      ],
    },
  ],
  license: { name: 'CC BY-SA 3.0' },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function fakeFetch(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    const word = decodeURIComponent(url.split('/').pop() ?? '');
    calls.push(word);
    const route = routes[word];
    return route ? route() : jsonResponse({ title: 'No Definitions Found' }, 404);
  };
  return { fetchImpl, calls };
}

describe('normalizeLookupWord', () => {
  it('accepts single words with apostrophes and hyphens', () => {
    expect(normalizeLookupWord('  Curious ')).toBe('curious');
    expect(normalizeLookupWord('Don’t')).toBe("don't");
    expect(normalizeLookupWord('well-known')).toBe('well-known');
    expect(normalizeLookupWord('Café')).toBe('café');
  });

  it('rejects anything that is not a single word', () => {
    for (const bad of ['', 'two words', 'a1', 'x'.repeat(41), '-lead', "trail'", '<script>', 'a--b', '__proto__']) {
      expect(normalizeLookupWord(bad), bad).toBeNull();
    }
  });
});

describe('normalizeEntries', () => {
  it('keeps safe senses, caps their number, and picks a pronunciation and UK audio', () => {
    expect(normalizeEntries('curious', [ENTRY])).toEqual({
      word: 'curious',
      phonetic: '/ˈkjʊəɹiəs/',
      audioUrl: 'https://api.dictionaryapi.dev/media/pronunciations/en/curious-uk.mp3',
      meanings: [
        {
          partOfSpeech: 'adjective',
          definitions: [
            { definition: 'Tending to ask questions, investigate, or explore.', example: 'A curious child.' },
            { definition: 'Unusual; odd; weird.' },
            { definition: 'Careful.' },
          ],
        },
      ],
    });
  });

  it('merges parts of speech across entries and drops unsafe or labelled senses', () => {
    const result = normalizeEntries('run', [
      { word: 'run', meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'To move quickly on foot.' }] }] },
      {
        word: 'run',
        phonetics: [{ audio: '//ssl.gstatic.com/run.mp3' }],
        meanings: [
          { partOfSpeech: 'verb', definitions: [{ definition: '(vulgar) A rude sense.' }, { definition: 'To operate a machine.' }] },
          { partOfSpeech: 'noun', definitions: [{ definition: 'An act of running.', example: 'A morning run.' }] },
        ],
      },
    ]);
    expect(result?.meanings).toEqual([
      { partOfSpeech: 'verb', definitions: [{ definition: 'To move quickly on foot.' }, { definition: 'To operate a machine.' }] },
      { partOfSpeech: 'noun', definitions: [{ definition: 'An act of running.', example: 'A morning run.' }] },
    ]);
    expect(result?.audioUrl).toBe('https://ssl.gstatic.com/run.mp3');
  });

  it('returns null when nothing safe is left', () => {
    expect(normalizeEntries('x', [])).toBeNull();
    expect(normalizeEntries('slangy', [{ word: 'slangy', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: '(offensive, slang) A slur.' }] }] }])).toBeNull();
  });

  it('never returns non-https audio', () => {
    const result = normalizeEntries('cat', [
      { word: 'cat', phonetics: [{ audio: 'http://insecure.example/cat.mp3' }, { audio: 'javascript:alert(1)' }], meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A small pet.' }] }] },
    ]);
    expect(result?.audioUrl).toBeUndefined();
  });
});

describe('lookupDefinition', () => {
  it('fetches once, then serves the cached definition', async () => {
    const { fetchImpl, calls } = fakeFetch({ curious: () => jsonResponse([ENTRY]) });
    const first = await lookupDefinition('Curious', { db: testDb.db, fetch: fetchImpl });
    expect(first.status).toBe('found');
    const second = await lookupDefinition('curious', { db: testDb.db, fetch: fetchImpl });
    expect(second).toEqual(first);
    expect(calls).toEqual(['curious']);
    const [row] = await testDb.db.select().from(definitions).where(eq(definitions.word, 'curious'));
    expect(row.source).toBe('dictionaryapi.dev');
  });

  it('caches misses for a week, then asks again', async () => {
    const { fetchImpl, calls } = fakeFetch({});
    const now = new Date('2026-09-27T10:00:00Z');
    expect(await lookupDefinition('zzyzx', { db: testDb.db, fetch: fetchImpl, now })).toEqual({ status: 'not-found' });
    const [row] = await testDb.db.select().from(definitions).where(eq(definitions.word, 'zzyzx'));
    expect(row.data).toBeNull();
    const callsAfterFirst = calls.length;

    await lookupDefinition('zzyzx', { db: testDb.db, fetch: fetchImpl, now: new Date(now.getTime() + NEGATIVE_CACHE_MS - 1000) });
    expect(calls.length).toBe(callsAfterFirst);

    await lookupDefinition('zzyzx', { db: testDb.db, fetch: fetchImpl, now: new Date(now.getTime() + NEGATIVE_CACHE_MS + 1000) });
    expect(calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('tries the dictionary form after a miss and caches it under both words', async () => {
    const discovery = { word: 'discovery', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'Something found for the first time.' }] }] };
    const { fetchImpl, calls } = fakeFetch({ discovery: () => jsonResponse([discovery]) });
    const result = await lookupDefinition('discoveries', { db: testDb.db, fetch: fetchImpl });
    expect(result).toMatchObject({ status: 'found', definition: { word: 'discovery' } });
    expect(calls).toEqual(['discoveries', 'discovery']);

    await lookupDefinition('discoveries', { db: testDb.db, fetch: fetchImpl });
    expect(calls).toHaveLength(2);
  });

  it('reports upstream failures as unavailable and does not cache them', async () => {
    const cases: Array<() => Response | Promise<Response>> = [
      () => new Response('oops', { status: 500 }),
      () => new Response('not json', { status: 200 }),
      () => jsonResponse({ unexpected: 'shape' }),
      () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')),
      () => new Response('x'.repeat(600 * 1024), { status: 200 }),
    ];
    for (const route of cases) {
      const { fetchImpl } = fakeFetch({ flaky: route });
      expect(await lookupDefinition('flaky', { db: testDb.db, fetch: fetchImpl })).toEqual({ status: 'unavailable' });
    }
    expect(await testDb.db.select().from(definitions)).toEqual([]);
  });

  it('still answers when the cache is unreachable', async () => {
    const brokenDb = {
      select: () => {
        throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      },
      insert: () => {
        throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      },
    } as unknown as TestDb['db'];
    const { fetchImpl } = fakeFetch({ curious: () => jsonResponse([ENTRY]) });
    expect((await lookupDefinition('curious', { db: brokenDb, fetch: fetchImpl })).status).toBe('found');
  });

  it('does not look up invalid input', async () => {
    const { fetchImpl, calls } = fakeFetch({});
    expect(await lookupDefinition('two words', { db: testDb.db, fetch: fetchImpl })).toEqual({ status: 'not-found' });
    expect(calls).toEqual([]);
  });

  it('define() returns the definition or null', async () => {
    const { fetchImpl } = fakeFetch({ curious: () => jsonResponse([ENTRY]) });
    expect((await define('curious', { db: testDb.db, fetch: fetchImpl }))?.word).toBe('curious');
    expect(await define('qwertyuiop', { db: testDb.db, fetch: fetchImpl })).toBeNull();
  });
});
