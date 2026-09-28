import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ingestRuns } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';

import { STALE_RUN_MS, acquireIngestLock, expireStaleRuns, finishRun, heartbeat } from './lock';

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

const T0 = new Date('2026-09-27T08:00:00Z');
const later = (ms: number) => new Date(T0.getTime() + ms);

async function run(id: string) {
  const [row] = await testDb.db.select().from(ingestRuns).where(eq(ingestRuns.id, id));
  return row;
}

describe('ingest lock', () => {
  it('lets exactly one of many concurrent triggers start a run', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, i) => acquireIngestLock(testDb.db, { trigger: i % 2 ? 'cron' : 'scheduler', now: T0 })),
    );
    const winners = attempts.filter((id): id is string => id !== null);
    expect(winners).toHaveLength(1);
    expect((await run(winners[0])).status).toBe('running');
  });

  it('is free again once the run finishes', async () => {
    const first = await acquireIngestLock(testDb.db, { trigger: 'cli', now: T0 });
    expect(first).not.toBeNull();
    expect(await acquireIngestLock(testDb.db, { trigger: 'cron', now: later(1_000) })).toBeNull();
    expect(await finishRun(testDb.db, first!, { status: 'ok', stats: { ready: 2 }, error: null, now: later(2_000) })).toBe(true);
    const second = await acquireIngestLock(testDb.db, { trigger: 'cron', now: later(3_000) });
    expect(second).not.toBeNull();
    const finished = await run(first!);
    expect(finished).toMatchObject({ status: 'ok', stats: { ready: 2 }, error: null });
    expect(finished.finishedAt?.toISOString()).toBe(later(2_000).toISOString());
  });

  it('takes over from a run that stopped responding, and that run cannot finish afterwards', async () => {
    const stale = await acquireIngestLock(testDb.db, { trigger: 'cli', now: T0 });
    expect(await acquireIngestLock(testDb.db, { trigger: 'cron', now: later(STALE_RUN_MS - 1) })).toBeNull();
    const fresh = await acquireIngestLock(testDb.db, { trigger: 'cron', now: later(STALE_RUN_MS + 1) });
    expect(fresh).not.toBeNull();
    expect((await run(stale!)).status).toBe('failed');
    expect(await heartbeat(testDb.db, stale!, later(STALE_RUN_MS + 2))).toBe(false);
    expect(await finishRun(testDb.db, stale!, { status: 'ok', stats: {}, error: null, now: later(STALE_RUN_MS + 3) })).toBe(false);
    expect((await run(stale!)).status).toBe('failed');
  });

  it('a heartbeat keeps a long run alive', async () => {
    const id = await acquireIngestLock(testDb.db, { trigger: 'cli', now: T0 });
    expect(await heartbeat(testDb.db, id!, later(STALE_RUN_MS - 60_000))).toBe(true);
    expect(await expireStaleRuns(testDb.db, later(STALE_RUN_MS + 60_000))).toBe(0);
    expect(await acquireIngestLock(testDb.db, { trigger: 'cron', now: later(STALE_RUN_MS + 60_000) })).toBeNull();
    expect(await expireStaleRuns(testDb.db, later(2 * STALE_RUN_MS))).toBe(1);
  });

  it('heartbeats merge into the stats without losing them', async () => {
    const id = await acquireIngestLock(testDb.db, { trigger: 'cli', now: T0 });
    await testDb.db.update(ingestRuns).set({ stats: { fetched: 3 } }).where(eq(ingestRuns.id, id!));
    await heartbeat(testDb.db, id!, later(5_000));
    expect((await run(id!)).stats).toEqual({ fetched: 3, heartbeatAt: later(5_000).toISOString() });
  });
});
