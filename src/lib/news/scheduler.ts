import 'server-only';

import { desc } from 'drizzle-orm';

import { getDb, type Database } from '@/lib/db';
import { describeDatabaseError } from '@/lib/db/migrate';
import { ingestRuns } from '@/lib/db/schema';
import { getEnv } from '@/lib/env';

import { isServerlessRuntime } from './cron';
import { runIngest } from './ingest';

/**
 * In-process scheduler for self-hosted servers (SPEC §5), started from
 * `instrumentation.ts`. Runs at 00, 04, 08, 12, 16 and 20 UTC, plus once
 * shortly after boot when the last run is older than one slot. Serverless
 * hosts use their own schedulers (Netlify Scheduled Functions, Vercel Cron,
 * GitHub Actions) because their instances do not live between requests.
 */

export const SLOT_MS = 4 * 60 * 60 * 1000;
export const CATCH_UP_DELAY_MS = 30_000;
const REVALIDATE_TIMEOUT_MS = 10_000;

/**
 * Milliseconds until the next 4-hour boundary in UTC. Slots are aligned to
 * the Unix epoch, which starts at midnight UTC, and 4 divides 24.
 */
export function msUntilNextSlot(nowMs: number): number {
  return SLOT_MS - (((nowMs % SLOT_MS) + SLOT_MS) % SLOT_MS);
}

/** Why the scheduler must not run here, or null when it may. */
export function schedulerDisabledReason(
  schedulerEnabled: boolean,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (!schedulerEnabled) return 'WIEGE_SCHEDULER=0';
  if (env.NEXT_PHASE === 'phase-production-build') return 'building';
  if (isServerlessRuntime(env)) return 'serverless host (use Netlify Scheduled Functions, Vercel Cron or GitHub Actions)';
  return null;
}

/** True when no run has started within the last slot. */
export async function isIngestDue(db: Database, now: Date): Promise<boolean> {
  const [last] = await db.select({ startedAt: ingestRuns.startedAt }).from(ingestRuns).orderBy(desc(ingestRuns.startedAt)).limit(1);
  return !last || now.getTime() - last.startedAt.getTime() >= SLOT_MS;
}

/**
 * Pages can only be revalidated inside a Next.js request, so after a run the
 * scheduler asks this server to do it through the cron endpoint. Without
 * `CRON_SECRET` (outside development) pages refresh through ISR within 10 minutes.
 */
export async function requestPageRevalidation(
  opts: { port?: string; secret?: string; nodeEnv?: string; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const env = getEnv();
  const secret = opts.secret ?? env.CRON_SECRET;
  const nodeEnv = opts.nodeEnv ?? env.NODE_ENV;
  if (!secret && nodeEnv !== 'development') {
    console.info('[scheduler] CRON_SECRET is not set; story pages will refresh within 10 minutes');
    return false;
  }
  const port = opts.port ?? process.env.PORT ?? '3000';
  try {
    const response = await (opts.fetchImpl ?? fetch)(`http://127.0.0.1:${port}/api/cron/ingest?revalidateOnly=1`, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => {});
    if (!response.ok) console.warn(`[scheduler] revalidation request returned HTTP ${response.status}`);
    return response.ok;
  } catch (error) {
    console.warn(`[scheduler] could not request revalidation: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/** One scheduled run followed by a revalidation request. Never throws. */
export async function runScheduledIngest(): Promise<void> {
  try {
    const result = await runIngest({ trigger: 'scheduler' });
    if (result.status === 'ok' || result.status === 'partial') await requestPageRevalidation();
  } catch (error) {
    console.error(`[scheduler] ingest failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface SchedulerHandle {
  stop(): void;
}

export interface SchedulerOptions {
  run?: () => Promise<void>;
  /** Decides whether to run once shortly after boot. */
  isDue?: () => Promise<boolean>;
  now?: () => number;
  catchUpDelayMs?: number;
}

// Survives dev HMR re-evaluation, so `register()` running again never starts a second timer.
const globalForScheduler = globalThis as typeof globalThis & { __wiegeScheduler?: SchedulerHandle };

/** Starts the scheduler once per process; later calls return the running one. */
export function startScheduler(opts: SchedulerOptions = {}): SchedulerHandle {
  if (globalForScheduler.__wiegeScheduler) return globalForScheduler.__wiegeScheduler;

  const run = opts.run ?? runScheduledIngest;
  const now = opts.now ?? Date.now;
  const isDue =
    opts.isDue ??
    (async () => {
      try {
        return await isIngestDue(getDb(), new Date(now()));
      } catch (error) {
        console.warn(`[scheduler] could not read the last run: ${describeDatabaseError(error)}`);
        return false;
      }
    });

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let running = false;

  const runOnce = async () => {
    if (running) return;
    running = true;
    try {
      await run();
    } finally {
      running = false;
    }
  };

  const scheduleNext = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      void runOnce().finally(scheduleNext);
    }, msUntilNextSlot(now()));
    // Never keep the process alive just for the scheduler.
    timer.unref?.();
  };

  const catchUp = setTimeout(() => {
    void isDue().then((due) => (due && !stopped ? runOnce() : undefined));
  }, opts.catchUpDelayMs ?? CATCH_UP_DELAY_MS);
  catchUp.unref?.();
  scheduleNext();

  const handle: SchedulerHandle = {
    stop() {
      stopped = true;
      clearTimeout(catchUp);
      if (timer) clearTimeout(timer);
      if (globalForScheduler.__wiegeScheduler === handle) globalForScheduler.__wiegeScheduler = undefined;
    },
  };
  globalForScheduler.__wiegeScheduler = handle;
  const next = new Date(now() + msUntilNextSlot(now())).toISOString();
  console.info(`[scheduler] news ingestion scheduled every 4 hours (next run ${next})`);
  return handle;
}
