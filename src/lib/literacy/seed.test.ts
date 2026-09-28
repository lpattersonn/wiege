import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { articles, lessons, sources } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';
import { createStoryQueries } from '@/lib/stories';

import { PRACTICE_SOURCE, PRACTICE_STORIES } from './samples';
import { practiceArticleId, seedPracticeStories } from './seed';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.truncateAll();
});

describe('seedPracticeStories', () => {
  it('inserts the practice source, articles and lessons', async () => {
    expect(await seedPracticeStories({ db: testDb.db })).toEqual({ inserted: 12, updated: 0 });

    const [source] = await testDb.db.select().from(sources).where(eq(sources.id, PRACTICE_SOURCE.id));
    expect(source).toMatchObject({ name: 'Wiege practice', enabled: false });

    const rows = await testDb.db.select().from(articles);
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      expect(row).toMatchObject({ status: 'ready', isSample: true, sourceId: PRACTICE_SOURCE.id, safety: { safe: true, reasons: [], method: 'seed' } });
      expect(row.url).toBe(`/read/${row.slug}`);
      expect(row.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }

    const lessonRows = await testDb.db.select().from(lessons);
    expect(lessonRows).toHaveLength(12);
    for (const lesson of lessonRows) {
      expect(lesson.generator).toBe('seed');
      expect(lesson.model).toBeNull();
      expect(lesson.readingGrade).toBeGreaterThan(0);
    }
  });

  it('is idempotent and brings existing practice stories up to date', async () => {
    await seedPracticeStories({ db: testDb.db });
    const id = practiceArticleId(PRACTICE_STORIES[0].slug);
    await testDb.db.update(articles).set({ title: 'Old title' }).where(eq(articles.id, id));
    await testDb.db.update(lessons).set({ readingGrade: 99 }).where(eq(lessons.articleId, id));

    expect(await seedPracticeStories({ db: testDb.db })).toEqual({ inserted: 0, updated: 12 });
    expect(await testDb.db.select().from(articles)).toHaveLength(12);
    const [article] = await testDb.db.select().from(articles).where(eq(articles.id, id));
    expect(article.title).toBe(PRACTICE_STORIES[0].title);
    const [lesson] = await testDb.db.select().from(lessons).where(eq(lessons.articleId, id));
    expect(lesson.readingGrade).toBeLessThan(20);
  });

  it('makes practice stories readable through the story queries, after any news', async () => {
    await seedPracticeStories({ db: testDb.db });
    const queries = createStoryQueries(testDb.db);
    const story = await queries.getStoryBySlug('practice-libraries-lend-more');
    expect(story).toMatchObject({ isSample: true, sourceName: 'Wiege practice', title: 'Libraries lend more than books' });
    expect(story?.content.quiz).toHaveLength(5);
    const page = await queries.listStories({ category: 'games' });
    expect(page.stories.map((s) => s.slug)).toEqual(expect.arrayContaining(['practice-chess-long-journey']));
    expect(page.stories.every((s) => s.isSample)).toBe(true);
  });
});
