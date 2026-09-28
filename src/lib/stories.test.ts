import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { CategorySlug } from '@/lib/categories';
import { articles, ingestRuns, lessons, sources, type ArticleStatus } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';
import type { LessonContent } from '@/lib/literacy/types';

import { createStoryQueries, decodeCursor, encodeCursor, type StoryQueries } from './stories';

let testDb: TestDb;
let q: StoryQueries;

beforeAll(async () => {
  testDb = await createTestDb();
  q = createStoryQueries(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.truncateAll();
});

function lesson(title: string): LessonContent {
  return {
    keyIdea: `Key idea of ${title}`,
    levels: {
      '7-8': { title: `${title} (7-8)`, paragraphs: ['One.'] },
      '9-10': { title: `${title} (9-10)`, paragraphs: ['One.', 'Two.'] },
    },
    vocabulary: [{ word: 'vivid', partOfSpeech: 'adjective', definition: 'bright', example: 'A vivid sky.', band: 'both' }],
    quiz: [
      { id: 'q1', skill: 'detail', question: 'Q?', choices: ['a', 'b', 'c', 'd'], answerIndex: 1, explanation: 'Because.' },
    ],
    writingPrompts: [{ id: 'p1', kind: 'summary', prompt: 'Sum it up.', minWords: 40, maxWords: 80, tips: ['Be brief.'] }],
    discussion: ['Why?', 'How?'],
  };
}

async function seedSource(id = 'src', category: CategorySlug = 'art') {
  await testDb.db.insert(sources).values({ id, name: `Source ${id}`, feedUrl: `https://${id}.example/feed`, homepage: `https://${id}.example`, category });
}

let counter = 0;
async function seedArticle(opts: {
  slug: string;
  category?: CategorySlug;
  publishedAt?: string;
  status?: ArticleStatus;
  isSample?: boolean;
  withLesson?: boolean;
  content?: unknown;
  sourceId?: string;
}) {
  counter += 1;
  const id = `id-${String(counter).padStart(4, '0')}`;
  await testDb.db.insert(articles).values({
    id,
    slug: opts.slug,
    sourceId: opts.sourceId ?? 'src',
    category: opts.category ?? 'art',
    title: `Original ${opts.slug}`,
    url: `https://src.example/${opts.slug}`,
    excerpt: `Excerpt ${opts.slug}`,
    publishedAt: new Date(opts.publishedAt ?? '2026-09-27T10:00:00Z'),
    status: opts.status ?? 'ready',
    safety: { safe: true, reasons: [], method: 'blocklist' },
    contentHash: `hash-${opts.slug}`,
    isSample: opts.isSample ?? false,
  });
  if (opts.withLesson !== false) {
    await testDb.db.insert(lessons).values({
      articleId: id,
      content: (opts.content ?? lesson(opts.slug)) as LessonContent,
      generator: opts.isSample ? 'seed' : 'heuristic',
      model: null,
      readingGrade: 7.2,
    });
  }
  return id;
}

describe('story queries on an empty database', () => {
  it('return empty results, never errors', async () => {
    expect(await q.getStoryBySlug('anything')).toBeNull();
    expect(await q.listStories()).toEqual({ stories: [], nextCursor: null });
    expect(await q.getLatestByCategory()).toEqual({ writing: [], games: [], art: [], sports: [] });
    expect(await q.getTodaySet()).toEqual([]);
    expect(await q.getRecentSlugs()).toEqual([]);
    expect(await q.getLastIngestSummary()).toBeNull();
    expect(await q.getStoryCounts()).toEqual({ ready: 0, pending: 0, rejected: 0, failed: 0, samples: 0 });
  });
});

describe('getStoryBySlug', () => {
  it('returns a ready story with its lesson as plain JSON', async () => {
    await seedSource();
    await seedArticle({ slug: 'painted-bridge-a1b2c3', publishedAt: '2026-09-26T08:00:00Z' });
    const story = await q.getStoryBySlug('painted-bridge-a1b2c3');
    expect(story).toMatchObject({
      slug: 'painted-bridge-a1b2c3',
      category: 'art',
      title: 'painted-bridge-a1b2c3 (7-8)',
      titles: { '7-8': 'painted-bridge-a1b2c3 (7-8)', '9-10': 'painted-bridge-a1b2c3 (9-10)' },
      keyIdea: 'Key idea of painted-bridge-a1b2c3',
      originalTitle: 'Original painted-bridge-a1b2c3',
      sourceName: 'Source src',
      sourceHomepage: 'https://src.example',
      publishedAt: '2026-09-26T08:00:00.000Z',
      isSample: false,
      generator: 'heuristic',
      readingGrade: 7.2,
    });
    expect(story?.content.quiz[0].answerIndex).toBe(1);
    expect(JSON.parse(JSON.stringify(story))).toEqual(story);
  });

  it('hides pending, rejected and failed articles and ones without a lesson', async () => {
    await seedSource();
    await seedArticle({ slug: 'pending', status: 'pending' });
    await seedArticle({ slug: 'rejected', status: 'rejected' });
    await seedArticle({ slug: 'failed', status: 'failed' });
    await seedArticle({ slug: 'no-lesson', withLesson: false });
    for (const slug of ['pending', 'rejected', 'failed', 'no-lesson', '', 'a/b', 'x'.repeat(300)]) {
      expect(await q.getStoryBySlug(slug)).toBeNull();
    }
  });

  it('hides a story whose stored lesson is malformed', async () => {
    await seedSource();
    await seedArticle({ slug: 'broken', content: { keyIdea: 'only this' } });
    const original = console.error;
    console.error = () => {};
    try {
      expect(await q.getStoryBySlug('broken')).toBeNull();
    } finally {
      console.error = original;
    }
  });
});

describe('listStories', () => {
  beforeEach(async () => {
    await seedSource();
    await seedSource('games-src', 'games');
    for (let i = 0; i < 5; i++) {
      await seedArticle({ slug: `art-${i}`, publishedAt: `2026-09-2${i}T10:00:00Z` });
    }
    await seedArticle({ slug: 'games-0', category: 'games', sourceId: 'games-src', publishedAt: '2026-09-27T12:00:00Z' });
    await seedArticle({ slug: 'practice-art', isSample: true, publishedAt: '2026-09-28T00:00:00Z' });
    await seedArticle({ slug: 'art-pending', status: 'pending', publishedAt: '2026-09-29T00:00:00Z' });
  });

  it('lists ready stories newest first with practice stories after news', async () => {
    const page = await q.listStories({ category: 'art' });
    expect(page.stories.map((s) => s.slug)).toEqual(['art-4', 'art-3', 'art-2', 'art-1', 'art-0', 'practice-art']);
    expect(page.nextCursor).toBeNull();
    expect(page.stories.at(-1)?.isSample).toBe(true);
  });

  it('can leave practice stories out and filter by category', async () => {
    expect((await q.listStories({ category: 'art', includeSamples: false })).stories).toHaveLength(5);
    expect((await q.listStories({ category: 'games' })).stories.map((s) => s.slug)).toEqual(['games-0']);
    expect((await q.listStories({ category: 'sports' })).stories).toEqual([]);
    expect((await q.listStories()).stories.map((s) => s.slug)).toEqual(['games-0', 'art-4', 'art-3', 'art-2', 'art-1', 'art-0', 'practice-art']);
  });

  it('paginates with an opaque cursor, without gaps or repeats', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await q.listStories({ category: 'art', limit: 2, cursor });
      seen.push(...page.stories.map((s) => s.slug));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(seen).toEqual(['art-4', 'art-3', 'art-2', 'art-1', 'art-0', 'practice-art']);
    expect(pages).toBe(3);
  });

  it('pages correctly through stories published at the same instant', async () => {
    await testDb.truncateAll();
    await seedSource();
    for (let i = 0; i < 5; i++) await seedArticle({ slug: `same-${i}`, publishedAt: '2026-09-27T10:00:00Z' });
    const first = await q.listStories({ limit: 3 });
    const second = await q.listStories({ limit: 3, cursor: first.nextCursor });
    const slugs = [...first.stories, ...second.stories].map((s) => s.slug);
    expect(new Set(slugs).size).toBe(5);
    expect(second.nextCursor).toBeNull();
  });

  it('clamps the page size and ignores tampered cursors', async () => {
    expect((await q.listStories({ limit: 0 })).stories).toHaveLength(1);
    expect((await q.listStories({ limit: 1000 })).stories).toHaveLength(7);
    expect((await q.listStories({ cursor: 'garbage' })).stories).toHaveLength(7);
    expect(decodeCursor('garbage')).toBeNull();
    expect(decodeCursor(Buffer.from('{"s":"x"}').toString('base64url'))).toBeNull();
    const cursor = { s: false, p: '2026-09-27T10:00:00.000Z', i: 'id-1' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });
});

describe('latest per category, today set and recent slugs', () => {
  beforeEach(async () => {
    await seedSource();
    await seedSource('w', 'writing');
    await seedArticle({ slug: 'art-old', publishedAt: '2026-09-20T10:00:00Z' });
    await seedArticle({ slug: 'art-new', publishedAt: '2026-09-27T10:00:00Z' });
    await seedArticle({ slug: 'art-mid', publishedAt: '2026-09-24T10:00:00Z' });
    await seedArticle({ slug: 'art-older', publishedAt: '2026-09-19T10:00:00Z' });
    await seedArticle({ slug: 'writing-practice', category: 'writing', sourceId: 'w', isSample: true });
  });

  it('returns the latest N per category (news before practice)', async () => {
    const latest = await q.getLatestByCategory(3);
    expect(latest.art.map((s) => s.slug)).toEqual(['art-new', 'art-mid', 'art-old']);
    expect(latest.writing.map((s) => s.slug)).toEqual(['writing-practice']);
    expect(latest.games).toEqual([]);
    expect(latest.sports).toEqual([]);
  });

  it('builds the today set: the newest story of each category that has one', async () => {
    expect((await q.getTodaySet()).map((s) => s.slug)).toEqual(['writing-practice', 'art-new']);
  });

  it('lists recent slugs for static generation', async () => {
    expect(await q.getRecentSlugs(3)).toEqual(['art-new', 'art-mid', 'art-old']);
    expect(await q.getRecentSlugs()).toHaveLength(5);
  });
});

describe('ingest summary and counts', () => {
  it('reports the last run and the last successful finish', async () => {
    await testDb.db.insert(ingestRuns).values([
      { id: 'r1', trigger: 'cron', status: 'ok', startedAt: new Date('2026-09-27T04:00:00Z'), finishedAt: new Date('2026-09-27T04:00:30Z'), stats: { ready: 3 } },
      { id: 'r2', trigger: 'cron', status: 'failed', startedAt: new Date('2026-09-27T08:00:00Z'), finishedAt: new Date('2026-09-27T08:00:05Z'), error: 'boom' },
      { id: 'r3', trigger: 'cli', status: 'running', startedAt: new Date('2026-09-27T12:00:00Z') },
    ]);
    expect(await q.getLastIngestSummary()).toEqual({
      lastRun: { id: 'r3', trigger: 'cli', status: 'running', startedAt: '2026-09-27T12:00:00.000Z', finishedAt: null, stats: {}, error: null },
      lastSuccessAt: '2026-09-27T04:00:30.000Z',
    });
  });

  it('counts articles by status', async () => {
    await seedSource();
    await seedArticle({ slug: 'a' });
    await seedArticle({ slug: 'b', isSample: true });
    await seedArticle({ slug: 'c', status: 'pending' });
    await seedArticle({ slug: 'd', status: 'rejected', withLesson: false });
    expect(await q.getStoryCounts()).toEqual({ ready: 2, pending: 1, rejected: 1, failed: 0, samples: 1 });
  });
});
