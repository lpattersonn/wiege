import 'server-only';

import { createHash } from 'node:crypto';

import { inArray } from 'drizzle-orm';

import { getDb, type Database } from '@/lib/db';
import { articles, lessons, sources, type NewArticleRow, type NewLessonRow } from '@/lib/db/schema';
import { lessonReadingGrade } from '@/lib/literacy/readability';
import { PRACTICE_SOURCE, PRACTICE_STORIES, type PracticeStory } from '@/lib/literacy/samples';
import { LessonContent, lessonContentProblems } from '@/lib/literacy/types';

/**
 * Seeds the practice stories (SPEC §6): source "Wiege practice" (disabled, so
 * ingestion never fetches it), articles with `isSample = true`, status `ready`
 * and safety method `seed`, and their hand-written lessons (`generator = 'seed'`).
 * Idempotent: missing stories are inserted; existing ones are brought up to
 * date with samples.ts (text fixes ship with the next seed).
 */

export function practiceArticleId(slug: string): string {
  return `practice:${slug}`;
}

function assertComplete(story: PracticeStory): void {
  const parsed = LessonContent.safeParse(story.content);
  const problems = parsed.success ? lessonContentProblems(parsed.data) : parsed.error.issues.map((i) => i.message);
  if (problems.length > 0) throw new Error(`Practice story ${story.slug} is incomplete: ${problems.join('; ')}`);
}

function articleRow(story: PracticeStory): NewArticleRow {
  return {
    id: practiceArticleId(story.slug),
    slug: story.slug,
    sourceId: PRACTICE_SOURCE.id,
    category: story.category,
    title: story.title,
    // Practice stories have no external original; this unique path is the story itself.
    url: `/read/${story.slug}`,
    author: null,
    excerpt: story.excerpt,
    publishedAt: new Date(story.publishedAt),
    status: 'ready',
    safety: { safe: true, reasons: [], method: 'seed' },
    contentHash: createHash('sha256').update(`${story.title}\n${story.excerpt}`).digest('hex'),
    isSample: true,
  };
}

function lessonRow(story: PracticeStory): NewLessonRow {
  return {
    articleId: practiceArticleId(story.slug),
    content: story.content,
    generator: 'seed',
    model: null,
    readingGrade: lessonReadingGrade(story.content),
  };
}

export async function seedPracticeStories(opts: { db?: Database } = {}): Promise<{ inserted: number; updated: number }> {
  PRACTICE_STORIES.forEach(assertComplete);
  const db = opts.db ?? getDb();

  return db.transaction(async (tx) => {
    const { id, name, feedUrl, homepage, category } = PRACTICE_SOURCE;
    await tx
      .insert(sources)
      .values({ id, name, feedUrl, homepage, category, enabled: false })
      .onConflictDoUpdate({ target: sources.id, set: { name, feedUrl, homepage, category, enabled: false } });

    const ids = PRACTICE_STORIES.map((s) => practiceArticleId(s.slug));
    const existing = new Set(
      (await tx.select({ id: articles.id }).from(articles).where(inArray(articles.id, ids))).map((row) => row.id),
    );
    const missing = PRACTICE_STORIES.filter((s) => !existing.has(practiceArticleId(s.slug)));
    const present = PRACTICE_STORIES.filter((s) => existing.has(practiceArticleId(s.slug)));

    if (missing.length > 0) {
      await tx.insert(articles).values(missing.map(articleRow)).onConflictDoNothing();
    }
    for (const story of present) {
      const { id: articleId, ...fields } = articleRow(story);
      await tx.update(articles).set(fields).where(inArray(articles.id, [articleId]));
    }

    for (const story of PRACTICE_STORIES) {
      const row = lessonRow(story);
      await tx
        .insert(lessons)
        .values(row)
        .onConflictDoUpdate({
          target: lessons.articleId,
          set: { content: row.content, generator: 'seed', model: null, readingGrade: row.readingGrade },
        });
    }
    return { inserted: missing.length, updated: present.length };
  });
}
