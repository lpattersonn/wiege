import 'server-only';

import { and, eq, isNull, lt, ne } from 'drizzle-orm';

import type { Database } from '@/lib/db';
import { articles, definitions, ingestRuns } from '@/lib/db/schema';
import { NEGATIVE_CACHE_MS } from '@/lib/dictionary';
import { purgeExpiredRateLimits } from '@/lib/rate-limit';

/**
 * Retention (SPEC §5 step 7). Practice stories (`isSample`) are never touched.
 * Students keep title snapshots in their local journal and word lists, so a
 * removed story only means its page shows "This story has moved on".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = {
  /** Kept so they are not fetched and re-reviewed while still in a feed. */
  rejected: 30,
  failed: 30,
  readyNews: 120,
  /** Never enriched in two weeks: no longer news. */
  stalePending: 14,
  runHistory: 90,
} as const;

export interface CleanupStats {
  rejected: number;
  failed: number;
  readyNews: number;
  stalePending: number;
  runs: number;
  rateLimits: number;
  /** Expired "no such word" cache rows (anyone can look up made-up words, so these must not pile up). */
  missingWords: number;
}

const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

export async function runCleanup(db: Database, now: Date): Promise<CleanupStats> {
  const news = eq(articles.isSample, false);
  const deleteArticles = async (status: 'rejected' | 'failed' | 'ready' | 'pending', column: 'fetchedAt' | 'publishedAt', days: number) => {
    const rows = await db
      .delete(articles)
      .where(and(news, eq(articles.status, status), lt(articles[column], daysBefore(now, days))))
      .returning({ id: articles.id });
    return rows.length;
  };

  const rejected = await deleteArticles('rejected', 'fetchedAt', RETENTION_DAYS.rejected);
  const failed = await deleteArticles('failed', 'fetchedAt', RETENTION_DAYS.failed);
  const readyNews = await deleteArticles('ready', 'publishedAt', RETENTION_DAYS.readyNews);
  const stalePending = await deleteArticles('pending', 'publishedAt', RETENTION_DAYS.stalePending);
  const runs = (
    await db
      .delete(ingestRuns)
      .where(and(ne(ingestRuns.status, 'running'), lt(ingestRuns.startedAt, daysBefore(now, RETENTION_DAYS.runHistory))))
      .returning({ id: ingestRuns.id })
  ).length;
  const rateLimits = await purgeExpiredRateLimits({ now, db });
  const missingWords = (
    await db
      .delete(definitions)
      .where(and(isNull(definitions.data), lt(definitions.fetchedAt, new Date(now.getTime() - NEGATIVE_CACHE_MS))))
      .returning({ word: definitions.word })
  ).length;
  return { rejected, failed, readyNews, stalePending, runs, rateLimits, missingWords };
}
