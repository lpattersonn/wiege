import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { articles, lessons, sources } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';
import { getPracticeStory } from '@/lib/literacy/samples';

const state = vi.hoisted(() => ({ db: null as unknown, unavailable: false }));

vi.mock('@/lib/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db')>()),
  getDb: () => {
    if (state.unavailable) {
      // What postgres.js raises when nothing listens on the port.
      throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:54329'), { code: 'ECONNREFUSED' });
    }
    return state.db;
  },
}));

const { GET } = await import('./route');

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  state.db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

const content = getPracticeStory('practice-libraries-lend-more')!.content;

beforeEach(async () => {
  state.unavailable = false;
  await testDb.truncateAll();
  await testDb.db
    .insert(sources)
    .values({ id: 'colossal', name: 'Colossal', feedUrl: 'https://www.thisiscolossal.com/feed/', homepage: 'https://www.thisiscolossal.com', category: 'art' });
  for (let i = 0; i < 5; i++) {
    const id = `art-${i}`;
    await testDb.db.insert(articles).values({
      id,
      slug: id,
      sourceId: 'colossal',
      category: 'art',
      title: `Art story ${i}`,
      url: `https://www.thisiscolossal.com/${id}/`,
      excerpt: 'An excerpt.',
      publishedAt: new Date(Date.UTC(2026, 8, 20 + i)),
      status: i === 4 ? 'pending' : 'ready',
      safety: { safe: true, reasons: [], method: 'blocklist' },
      contentHash: id,
    });
    await testDb.db.insert(lessons).values({ articleId: id, content, generator: 'heuristic', readingGrade: 7 });
  }
});

const get = (query: string) => GET(new Request(`http://localhost:3000/api/stories${query}`));

describe('GET /api/stories', () => {
  it('pages through ready stories newest first with an opaque cursor', async () => {
    const first = await get('?category=art&limit=2');
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toMatch(/^public, s-maxage=300/);
    const page1 = (await first.json()) as { stories: Array<{ slug: string }>; nextCursor: string | null };
    expect(page1.stories.map((s) => s.slug)).toEqual(['art-3', 'art-2']);
    expect(page1.nextCursor).toEqual(expect.any(String));

    const second = (await (await get(`?category=art&limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`)).json()) as {
      stories: Array<{ slug: string }>;
      nextCursor: string | null;
    };
    // The pending story (art-4) is never listed.
    expect(second.stories.map((s) => s.slug)).toEqual(['art-1', 'art-0']);
    expect(second.nextCursor).toBeNull();
  });

  it('rejects unknown categories, forged cursors and silly limits', async () => {
    for (const query of ['?category=politics', '?cursor=not-a-cursor', '?limit=0', '?limit=51', '?limit=abc', '?samples=maybe']) {
      const response = await get(query);
      expect(response.status, query).toBe(400);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toMatchObject({ error: 'invalid-query' });
    }
  });

  it('answers 503 when the database is unreachable', async () => {
    state.unavailable = true;
    const response = await get('?category=art');
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'unavailable' });
  });
});
