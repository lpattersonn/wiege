import 'server-only';

import { z } from 'zod';

import { aiAvailable } from '@/lib/ai/client';
import { getDb, isDatabaseUnavailableError, type Database } from '@/lib/db';
import { describeDatabaseError } from '@/lib/db/migrate';
import { sources } from '@/lib/db/schema';
import { createStoryQueries, type StoryCounts } from '@/lib/stories';

import { isCuratedFeed } from './feeds';

/**
 * Public service status for `GET /api/health` (SPEC §8): a database ping, the
 * last ingest and story counts. Deliberately free of secrets, connection
 * details and raw error messages.
 */

/** News is "fresh" when a run succeeded within this window (three missed 4-hour slots). */
export const FRESHNESS_WINDOW_MS = 12 * 60 * 60 * 1000;

export interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  checkedAt: string;
  database: 'ok' | 'unavailable';
  ai: boolean;
  ingest: {
    running: boolean;
    lastRunStatus: string;
    lastRunTrigger: string;
    lastRunStartedAt: string;
    lastRunFinishedAt: string | null;
    lastSuccessAt: string | null;
    fresh: boolean;
    lastRun: { new: number; pending: number; ready: number; rejected: number; failed: number; backlog: number };
  } | null;
  stories: StoryCounts | null;
  sources: { curated: number; enabled: number; failing: number } | null;
}

const count = z.number().int().nonnegative().catch(0);
const RunCounts = z.object({
  new: count,
  pending: count,
  ready: count,
  rejected: count,
  failed: count,
  backlog: count,
});

export async function getHealthReport(opts: { db?: Database; now?: Date; aiEnabled?: boolean } = {}): Promise<HealthReport> {
  const now = opts.now ?? new Date();
  const ai = opts.aiEnabled ?? aiAvailable();
  const base = { checkedAt: now.toISOString(), ai };
  try {
    const db = opts.db ?? getDb();
    const queries = createStoryQueries(db);
    const summary = await queries.getLastIngestSummary();
    const stories = await queries.getStoryCounts();
    const sourceRows = await db.select({ id: sources.id, enabled: sources.enabled, lastError: sources.lastError }).from(sources);
    const curated = sourceRows.filter((row) => isCuratedFeed(row.id));

    const lastSuccessMs = summary?.lastSuccessAt ? Date.parse(summary.lastSuccessAt) : null;
    const fresh = lastSuccessMs !== null && now.getTime() - lastSuccessMs <= FRESHNESS_WINDOW_MS;
    const ingest: HealthReport['ingest'] = summary
      ? {
          running: summary.lastRun.status === 'running',
          lastRunStatus: summary.lastRun.status,
          lastRunTrigger: summary.lastRun.trigger,
          lastRunStartedAt: summary.lastRun.startedAt,
          lastRunFinishedAt: summary.lastRun.finishedAt,
          lastSuccessAt: summary.lastSuccessAt,
          fresh,
          lastRun: RunCounts.parse(summary.lastRun.stats),
        }
      : null;
    return {
      ...base,
      status: fresh ? 'ok' : 'degraded',
      database: 'ok',
      ingest,
      stories,
      sources: {
        curated: curated.length,
        enabled: curated.filter((row) => row.enabled).length,
        failing: curated.filter((row) => row.enabled && row.lastError).length,
      },
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) console.error(`[health] check failed: ${describeDatabaseError(error)}`);
    return { ...base, status: 'down', database: 'unavailable', ingest: null, stories: null, sources: null };
  }
}
