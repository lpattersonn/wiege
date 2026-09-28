import 'server-only';

import { and, count, desc, eq, gt, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/categories';
import { getDb, isDatabaseUnavailableError, type Database } from '@/lib/db';
import {
  articles,
  ingestRuns,
  lessons,
  sources,
  type IngestRunStatus,
  type IngestRunTrigger,
  type LessonGenerator,
} from '@/lib/db/schema';
import { LessonContent, type GradeBand } from '@/lib/literacy/types';

/**
 * Read queries for published stories (SPEC §3, §8). Only `ready` articles that
 * have a lesson are ever returned; `pending`, `rejected` and `failed` items are
 * never shown to students. Results are plain JSON (dates as ISO strings) so they
 * can be cached by Next.js and passed to client components.
 *
 * The exported functions are cached with `unstable_cache`, tagged `stories`
 * (revalidated after every ingest) and time-limited to 10 minutes. They return
 * empty results when the database is empty, unreachable or not migrated, so
 * static pages always build. Outside a Next.js request (scripts, tests) use
 * `createStoryQueries(db)`, the same queries without the cache.
 */

export const STORIES_TAG = 'stories';
export const STORIES_REVALIDATE_SECONDS = 600;

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

export interface StorySummary {
  slug: string;
  category: CategorySlug;
  /** Title of the default level (Grade 7–8). */
  title: string;
  titles: Record<GradeBand, string>;
  keyIdea: string;
  sourceName: string;
  /** ISO 8601. */
  publishedAt: string;
  /** Practice story (never presented as news). */
  isSample: boolean;
}

export interface Story extends StorySummary {
  /** The source's headline (shown in attribution only). */
  originalTitle: string;
  url: string;
  author: string | null;
  excerpt: string;
  sourceHomepage: string;
  content: LessonContent;
  generator: LessonGenerator;
  model: string | null;
  readingGrade: number;
}

export interface StoryPage {
  stories: StorySummary[];
  /** Opaque; pass back as `cursor` for the next page. Null when there are no more. */
  nextCursor: string | null;
}

export interface ListStoriesOptions {
  category?: CategorySlug;
  /** 1–50, default 12. */
  limit?: number;
  cursor?: string | null;
  /** Practice stories come after all news. Default true. */
  includeSamples?: boolean;
}

export type LatestByCategory = Record<CategorySlug, StorySummary[]>;

export interface IngestRunSummary {
  id: string;
  trigger: IngestRunTrigger;
  status: IngestRunStatus;
  startedAt: string;
  finishedAt: string | null;
  stats: Record<string, unknown>;
  error: string | null;
}

export interface IngestSummary {
  lastRun: IngestRunSummary;
  /** When the newest successful (`ok` or `partial`) run finished, for "Updated 2 hours ago". */
  lastSuccessAt: string | null;
}

export interface StoryCounts {
  ready: number;
  pending: number;
  rejected: number;
  failed: number;
  /** Ready practice stories (included in `ready`). */
  samples: number;
}

// --- cursor -------------------------------------------------------------------

const CursorSchema = z.object({
  s: z.boolean(),
  p: z.iso.datetime(),
  i: z.string().min(1).max(200),
});
type Cursor = z.infer<typeof CursorSchema>;

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

/** Null for anything that is not a cursor we issued (tampered input starts from the top). */
export function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value || value.length > 500) return null;
  try {
    const parsed = CursorSchema.safeParse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const SLUG_PATTERN = /^[^\s/?#]{1,200}$/;

export function isPlausibleSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

const clampLimit = (limit: number | undefined, fallback: number) =>
  Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number.isFinite(limit) ? (limit as number) : fallback)));

// --- queries -------------------------------------------------------------------

const summaryColumns = {
  id: articles.id,
  slug: articles.slug,
  category: articles.category,
  articleTitle: articles.title,
  publishedAt: articles.publishedAt,
  isSample: articles.isSample,
  sourceName: sources.name,
  keyIdea: sql<string | null>`${lessons.content}->>'keyIdea'`,
  titleJunior: sql<string | null>`${lessons.content}#>>'{levels,7-8,title}'`,
  titleSenior: sql<string | null>`${lessons.content}#>>'{levels,9-10,title}'`,
};

interface SummaryRow {
  slug: string;
  category: CategorySlug;
  articleTitle: string;
  publishedAt: Date;
  isSample: boolean;
  sourceName: string;
  keyIdea: string | null;
  titleJunior: string | null;
  titleSenior: string | null;
}

function toSummary(row: SummaryRow): StorySummary {
  const junior = row.titleJunior || row.articleTitle;
  return {
    slug: row.slug,
    category: row.category,
    title: junior,
    titles: { '7-8': junior, '9-10': row.titleSenior || junior },
    keyIdea: row.keyIdea ?? '',
    sourceName: row.sourceName,
    publishedAt: row.publishedAt.toISOString(),
    isSample: row.isSample,
  };
}

const isReady = eq(articles.status, 'ready');

function afterCursor(cursor: Cursor): SQL | undefined {
  const publishedAt = new Date(cursor.p);
  return or(
    gt(articles.isSample, cursor.s),
    and(
      eq(articles.isSample, cursor.s),
      or(lt(articles.publishedAt, publishedAt), and(eq(articles.publishedAt, publishedAt), lt(articles.id, cursor.i))),
    ),
  );
}

export function createStoryQueries(db: Database) {
  const readySummaries = () =>
    db
      .select(summaryColumns)
      .from(articles)
      .innerJoin(lessons, eq(lessons.articleId, articles.id))
      .innerJoin(sources, eq(sources.id, articles.sourceId));

  const newestFirst = [articles.isSample, desc(articles.publishedAt), desc(articles.id)] as const;

  async function listStories(options: ListStoriesOptions = {}): Promise<StoryPage> {
    const limit = clampLimit(options.limit, DEFAULT_PAGE_SIZE);
    const cursor = decodeCursor(options.cursor);
    const rows = await readySummaries()
      .where(
        and(
          isReady,
          options.category ? eq(articles.category, options.category) : undefined,
          options.includeSamples === false ? eq(articles.isSample, false) : undefined,
          cursor ? afterCursor(cursor) : undefined,
        ),
      )
      .orderBy(...newestFirst)
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      stories: page.map(toSummary),
      nextCursor:
        rows.length > limit && last ? encodeCursor({ s: last.isSample, p: last.publishedAt.toISOString(), i: last.id }) : null,
    };
  }

  async function getStoryBySlug(slug: string): Promise<Story | null> {
    if (!isPlausibleSlug(slug)) return null;
    const [row] = await db
      .select({
        summary: summaryColumns,
        url: articles.url,
        author: articles.author,
        excerpt: articles.excerpt,
        sourceHomepage: sources.homepage,
        content: lessons.content,
        generator: lessons.generator,
        model: lessons.model,
        readingGrade: lessons.readingGrade,
      })
      .from(articles)
      .innerJoin(lessons, eq(lessons.articleId, articles.id))
      .innerJoin(sources, eq(sources.id, articles.sourceId))
      .where(and(isReady, eq(articles.slug, slug)))
      .limit(1);
    if (!row) return null;
    const content = LessonContent.safeParse(row.content);
    if (!content.success) {
      console.error(`[stories] lesson for "${slug}" does not match LessonContent; hiding it`);
      return null;
    }
    return {
      ...toSummary(row.summary),
      originalTitle: row.summary.articleTitle,
      url: row.url,
      author: row.author,
      excerpt: row.excerpt,
      sourceHomepage: row.sourceHomepage,
      content: content.data,
      generator: row.generator,
      model: row.model,
      readingGrade: row.readingGrade,
    };
  }

  async function getLatestByCategory(limitPerCategory = 3): Promise<LatestByCategory> {
    const pages = await Promise.all(
      CATEGORY_SLUGS.map((category) => listStories({ category, limit: clampLimit(limitPerCategory, 3) })),
    );
    return Object.fromEntries(CATEGORY_SLUGS.map((category, i) => [category, pages[i].stories])) as LatestByCategory;
  }

  /** Newest ready story per category (news before practice), for the client's "Today's story" pick. */
  async function getTodaySet(): Promise<StorySummary[]> {
    const latest = await getLatestByCategory(1);
    return CATEGORY_SLUGS.flatMap((category) => latest[category]);
  }

  /** Slugs to prerender in `generateStaticParams` (newest news first, then practice stories). */
  async function getRecentSlugs(limit = 50): Promise<string[]> {
    const rows = await db
      .select({ slug: articles.slug })
      .from(articles)
      .innerJoin(lessons, eq(lessons.articleId, articles.id))
      .where(isReady)
      .orderBy(...newestFirst)
      .limit(Math.max(1, Math.min(500, Math.floor(limit))));
    return rows.map((row) => row.slug);
  }

  async function getLastIngestSummary(): Promise<IngestSummary | null> {
    const [lastRun] = await db.select().from(ingestRuns).orderBy(desc(ingestRuns.startedAt)).limit(1);
    if (!lastRun) return null;
    const [lastSuccess] = await db
      .select({ finishedAt: ingestRuns.finishedAt })
      .from(ingestRuns)
      .where(and(inArray(ingestRuns.status, ['ok', 'partial']), sql`${ingestRuns.finishedAt} is not null`))
      .orderBy(desc(ingestRuns.finishedAt))
      .limit(1);
    return {
      lastRun: {
        id: lastRun.id,
        trigger: lastRun.trigger,
        status: lastRun.status,
        startedAt: lastRun.startedAt.toISOString(),
        finishedAt: lastRun.finishedAt?.toISOString() ?? null,
        stats: lastRun.stats,
        error: lastRun.error,
      },
      lastSuccessAt: lastSuccess?.finishedAt?.toISOString() ?? null,
    };
  }

  async function getStoryCounts(): Promise<StoryCounts> {
    const rows = await db
      .select({ status: articles.status, isSample: articles.isSample, n: count() })
      .from(articles)
      .groupBy(articles.status, articles.isSample);
    const counts: StoryCounts = { ready: 0, pending: 0, rejected: 0, failed: 0, samples: 0 };
    for (const row of rows) {
      counts[row.status] += row.n;
      if (row.status === 'ready' && row.isSample) counts.samples += row.n;
    }
    return counts;
  }

  return { listStories, getStoryBySlug, getLatestByCategory, getTodaySet, getRecentSlugs, getLastIngestSummary, getStoryCounts };
}

export type StoryQueries = ReturnType<typeof createStoryQueries>;

// --- cached, resilient exports -------------------------------------------------------

const warned = new Set<string>();

function cachedQuery<A extends unknown[], R>(
  name: keyof StoryQueries,
  run: (queries: StoryQueries, ...args: A) => Promise<R>,
  fallback: () => R,
): (...args: A) => Promise<R> {
  const cached = unstable_cache((...args: A) => run(createStoryQueries(getDb()), ...args), ['wiege', 'stories', name], {
    tags: [STORIES_TAG],
    revalidate: STORIES_REVALIDATE_SECONDS,
  });
  return async (...args: A) => {
    try {
      return await cached(...args);
    } catch (error) {
      // Thrown inside the cache scope, so the empty fallback is never cached.
      if (!isDatabaseUnavailableError(error)) throw error;
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`[stories] database unavailable in ${name}; rendering empty state`);
      }
      return fallback();
    }
  };
}

const emptyLatest = (): LatestByCategory =>
  Object.fromEntries(CATEGORY_SLUGS.map((category) => [category, []])) as unknown as LatestByCategory;

export const getStoryBySlug = cachedQuery('getStoryBySlug', (q, slug: string) => q.getStoryBySlug(slug), () => null);

export const listStories = cachedQuery(
  'listStories',
  (q, options: ListStoriesOptions = {}) => q.listStories(options),
  (): StoryPage => ({ stories: [], nextCursor: null }),
);

export const getLatestByCategory = cachedQuery(
  'getLatestByCategory',
  (q, limitPerCategory: number = 3) => q.getLatestByCategory(limitPerCategory),
  emptyLatest,
);

export const getTodaySet = cachedQuery('getTodaySet', (q) => q.getTodaySet(), (): StorySummary[] => []);

export const getRecentSlugs = cachedQuery('getRecentSlugs', (q, limit: number = 50) => q.getRecentSlugs(limit), (): string[] => []);

export const getLastIngestSummary = cachedQuery(
  'getLastIngestSummary',
  (q) => q.getLastIngestSummary(),
  (): IngestSummary | null => null,
);
