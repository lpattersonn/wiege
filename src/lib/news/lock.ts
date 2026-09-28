import 'server-only';

import { randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '@/lib/db';
import { ingestRuns, type IngestRunStatus, type IngestRunTrigger } from '@/lib/db/schema';

/**
 * The ingest lock (SPEC §5 step 1) is the `running` row itself: the partial
 * unique index `ingest_runs_single_running_idx` lets at most one row be
 * `running`, so of several concurrent triggers exactly one insert succeeds.
 * A run records a heartbeat as it works; one silent for 20 minutes is
 * considered dead and marked `failed` so the next trigger can start.
 */

export const STALE_RUN_MS = 20 * 60 * 1000;

const lastSignOfLife = sql`coalesce((${ingestRuns.stats}->>'heartbeatAt')::timestamptz, ${ingestRuns.startedAt})`;

/** Marks `running` rows with no heartbeat for `STALE_RUN_MS` as failed; returns how many. */
export async function expireStaleRuns(db: Database, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_RUN_MS).toISOString();
  const expired = await db
    .update(ingestRuns)
    .set({ status: 'failed', finishedAt: now, error: 'The run stopped responding for 20 minutes and was marked failed.' })
    .where(and(eq(ingestRuns.status, 'running'), sql`${lastSignOfLife} < ${cutoff}::timestamptz`))
    .returning({ id: ingestRuns.id });
  return expired.length;
}

/** Starts a run and returns its id, or null when another run holds the lock. */
export async function acquireIngestLock(db: Database, opts: { trigger: IngestRunTrigger; now: Date }): Promise<string | null> {
  await expireStaleRuns(db, opts.now);
  const [row] = await db
    .insert(ingestRuns)
    .values({
      id: randomUUID(),
      trigger: opts.trigger,
      status: 'running',
      startedAt: opts.now,
      stats: { heartbeatAt: opts.now.toISOString() },
    })
    // The only possible conflict is the single-running index: the lock is taken.
    .onConflictDoNothing()
    .returning({ id: ingestRuns.id });
  return row?.id ?? null;
}

/** Records that the run is alive. False when the run no longer holds the lock (it was expired). */
export async function heartbeat(db: Database, runId: string, now: Date): Promise<boolean> {
  const rows = await db
    .update(ingestRuns)
    .set({ stats: sql`${ingestRuns.stats} || ${JSON.stringify({ heartbeatAt: now.toISOString() })}::jsonb` })
    .where(and(eq(ingestRuns.id, runId), eq(ingestRuns.status, 'running')))
    .returning({ id: ingestRuns.id });
  return rows.length > 0;
}

/** Ends the run (releasing the lock). False when the run had already been expired. */
export async function finishRun(
  db: Database,
  runId: string,
  result: { status: Exclude<IngestRunStatus, 'running'>; stats: Record<string, unknown>; error: string | null; now: Date },
): Promise<boolean> {
  const rows = await db
    .update(ingestRuns)
    .set({ status: result.status, finishedAt: result.now, stats: result.stats, error: result.error })
    .where(and(eq(ingestRuns.id, runId), eq(ingestRuns.status, 'running')))
    .returning({ id: ingestRuns.id });
  return rows.length > 0;
}
