import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { articles, definitions, ingestRuns, lessons, rateLimits, sources, type ArticleStatus } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';
import type { LessonContent } from '@/lib/literacy/types';

import { runCleanup } from './cleanup';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.truncateAll();
  await testDb.db.insert(sources).values({ id: 'src', name: 'Source', feedUrl: 'https://src.example/feed', homepage: 'https://src.example', category: 'art' });
});

const NOW = new Date('2026-09-27T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

const lessonContent = { keyIdea: 'x' } as unknown as LessonContent;

async function article(id: string, status: ArticleStatus, opts: { fetchedDaysAgo?: number; publishedDaysAgo?: number; isSample?: boolean } = {}) {
  await testDb.db.insert(articles).values({
    id,
    slug: id,
    sourceId: 'src',
    category: 'art',
    title: id,
    url: `https://src.example/${id}`,
    excerpt: 'excerpt',
    publishedAt: daysAgo(opts.publishedDaysAgo ?? 1),
    fetchedAt: daysAgo(opts.fetchedDaysAgo ?? 1),
    status,
    safety: { safe: status !== 'rejected', reasons: [], method: 'blocklist' },
    contentHash: id,
    isSample: opts.isSample ?? false,
  });
  if (status === 'ready') {
    await testDb.db.insert(lessons).values({ articleId: id, content: lessonContent, generator: 'heuristic', readingGrade: 7 });
  }
}

async function remaining(): Promise<string[]> {
  return (await testDb.db.select({ id: articles.id }).from(articles)).map((row) => row.id).sort();
}

describe('runCleanup', () => {
  it('applies each retention rule and keeps everything younger', async () => {
    await article('rejected-old', 'rejected', { fetchedDaysAgo: 31 });
    await article('rejected-new', 'rejected', { fetchedDaysAgo: 29 });
    await article('failed-old', 'failed', { fetchedDaysAgo: 31 });
    await article('ready-old', 'ready', { publishedDaysAgo: 121 });
    await article('ready-new', 'ready', { publishedDaysAgo: 119 });
    await article('pending-stale', 'pending', { publishedDaysAgo: 15 });
    await article('pending-new', 'pending', { publishedDaysAgo: 2 });

    const stats = await runCleanup(testDb.db, NOW);

    expect(stats).toMatchObject({ rejected: 1, failed: 1, readyNews: 1, stalePending: 1 });
    expect(await remaining()).toEqual(['pending-new', 'ready-new', 'rejected-new']);
    // Lessons go with their article.
    expect(await testDb.db.select({ id: lessons.articleId }).from(lessons)).toEqual([{ id: 'ready-new' }]);
  });

  it('never deletes practice stories', async () => {
    await article('sample', 'ready', { publishedDaysAgo: 400, isSample: true });
    await runCleanup(testDb.db, NOW);
    expect(await remaining()).toEqual(['sample']);
  });

  it('trims old run history (never a running run) and expired rate-limit keys', async () => {
    await testDb.db.insert(ingestRuns).values([
      { id: 'old', trigger: 'cron', status: 'ok', startedAt: daysAgo(91) },
      { id: 'recent', trigger: 'cron', status: 'ok', startedAt: daysAgo(5) },
      { id: 'running', trigger: 'cli', status: 'running', startedAt: daysAgo(91) },
    ]);
    await testDb.db.insert(rateLimits).values([
      { key: 'expired', count: 3, resetAt: daysAgo(1) },
      { key: 'live', count: 3, resetAt: new Date(NOW.getTime() + 60_000) },
    ]);

    const stats = await runCleanup(testDb.db, NOW);

    expect(stats).toMatchObject({ runs: 1, rateLimits: 1 });
    expect((await testDb.db.select({ id: ingestRuns.id }).from(ingestRuns)).map((row) => row.id).sort()).toEqual(['recent', 'running']);
    expect(await testDb.db.select({ key: rateLimits.key }).from(rateLimits)).toEqual([{ key: 'live' }]);
  });

  it('drops expired "no such word" cache rows but keeps real definitions and recent misses', async () => {
    const definition = { word: 'curious', meanings: [{ partOfSpeech: 'adjective', definitions: [{ definition: 'eager to know' }] }] };
    await testDb.db.insert(definitions).values([
      { word: 'curious', data: definition, source: 'test', fetchedAt: daysAgo(400) },
      { word: 'blorptastic', data: null, source: 'test', fetchedAt: daysAgo(8) },
      { word: 'zzzq', data: null, source: 'test', fetchedAt: daysAgo(2) },
    ]);

    const stats = await runCleanup(testDb.db, NOW);

    expect(stats.missingWords).toBe(1);
    expect((await testDb.db.select({ word: definitions.word }).from(definitions)).map((row) => row.word).sort()).toEqual(['curious', 'zzzq']);
  });
});
