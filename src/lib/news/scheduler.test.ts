import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ingestRuns } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';

import { SLOT_MS, isIngestDue, msUntilNextSlot, requestPageRevalidation, schedulerDisabledReason, startScheduler } from './scheduler';

const at = (iso: string) => Date.parse(iso);

describe('msUntilNextSlot', () => {
  it('aligns to 00, 04, 08, 12, 16 and 20 UTC', () => {
    expect(msUntilNextSlot(at('2026-09-27T00:00:00Z'))).toBe(SLOT_MS);
    expect(msUntilNextSlot(at('2026-09-27T03:59:59.999Z'))).toBe(1);
    expect(msUntilNextSlot(at('2026-09-27T05:30:00Z'))).toBe(2.5 * 60 * 60 * 1000);
    expect(msUntilNextSlot(at('2026-09-27T23:00:00Z'))).toBe(60 * 60 * 1000);
    const next = at('2026-09-27T13:17:00Z') + msUntilNextSlot(at('2026-09-27T13:17:00Z'));
    expect(new Date(next).toISOString()).toBe('2026-09-27T16:00:00.000Z');
  });
});

describe('schedulerDisabledReason', () => {
  it('runs only when enabled, not building and not serverless', () => {
    expect(schedulerDisabledReason(true, {})).toBeNull();
    expect(schedulerDisabledReason(false, {})).toBe('WIEGE_SCHEDULER=0');
    expect(schedulerDisabledReason(true, { NEXT_PHASE: 'phase-production-build' })).toBe('building');
    expect(schedulerDisabledReason(true, { NETLIFY: 'true' })).toMatch(/serverless/);
    expect(schedulerDisabledReason(true, { AWS_LAMBDA_FUNCTION_NAME: 'handler' })).toMatch(/serverless/);
  });
});

describe('isIngestDue', () => {
  let testDb: TestDb;
  const NOW = new Date('2026-09-27T12:00:00Z');

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(async () => {
    await testDb.close();
  });
  beforeEach(async () => {
    await testDb.truncateAll();
  });

  it('is due with no runs, or when the last one started a slot ago', async () => {
    expect(await isIngestDue(testDb.db, NOW)).toBe(true);
    await testDb.db.insert(ingestRuns).values({ id: 'r', trigger: 'cron', status: 'ok', startedAt: new Date(NOW.getTime() - SLOT_MS + 60_000) });
    expect(await isIngestDue(testDb.db, NOW)).toBe(false);
    expect(await isIngestDue(testDb.db, new Date(NOW.getTime() + 60_000))).toBe(true);
  });
});

describe('startScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-27T11:00:00Z') });
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('catches up once after boot when due, then runs on every slot', async () => {
    const run = vi.fn(async () => {});
    const handle = startScheduler({ run, isDue: async () => true, now: () => Date.now(), catchUpDelayMs: 1_000 });
    try {
      await vi.advanceTimersByTimeAsync(1_000);
      expect(run).toHaveBeenCalledTimes(1);
      // 11:00:01 -> 12:00 slot.
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(run).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(SLOT_MS);
      expect(run).toHaveBeenCalledTimes(3);
    } finally {
      handle.stop();
    }
  });

  it('skips the catch-up when not due, and starts only once per process', async () => {
    const run = vi.fn(async () => {});
    const handle = startScheduler({ run, isDue: async () => false, now: () => Date.now(), catchUpDelayMs: 1_000 });
    try {
      expect(startScheduler({ run })).toBe(handle);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(run).not.toHaveBeenCalled();
    } finally {
      handle.stop();
    }
    const again = startScheduler({ run, isDue: async () => false, now: () => Date.now() });
    expect(again).not.toBe(handle);
    again.stop();
  });

  it('never overlaps runs and stops cleanly', async () => {
    let finish: () => void = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const handle = startScheduler({ run, isDue: async () => true, now: () => Date.now(), catchUpDelayMs: 59 * 60 * 1000 });
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    // The catch-up run is still going when the 12:00 slot fires.
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    handle.stop();
    await vi.advanceTimersByTimeAsync(2 * SLOT_MS);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('requestPageRevalidation', () => {
  it('asks this server to revalidate, with the cron secret', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"revalidated":true}'));
    const ok = await requestPageRevalidation({ port: '4000', secret: 'a-long-random-cron-secret-value', nodeEnv: 'production', fetchImpl });
    expect(ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:4000/api/cron/ingest?revalidateOnly=1',
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer a-long-random-cron-secret-value' } }),
    );
  });

  it('relies on ISR when no secret is set outside development', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response(''));
    expect(await requestPageRevalidation({ secret: '', nodeEnv: 'production', fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('never throws when the server cannot be reached', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await requestPageRevalidation({ nodeEnv: 'development', fetchImpl })).toBe(false);
    vi.restoreAllMocks();
  });
});
