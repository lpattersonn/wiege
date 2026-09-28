import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Database } from '@/lib/db';
import { ingestRuns, sources } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';

import { syncSources } from './sources';
import { FRESHNESS_WINDOW_MS, getHealthReport } from './status';

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

const NOW = new Date('2026-09-27T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('getHealthReport', () => {
  it('is degraded before the first successful run', async () => {
    await syncSources(testDb.db);
    const report = await getHealthReport({ db: testDb.db, now: NOW, aiEnabled: false });
    expect(report).toMatchObject({
      status: 'degraded',
      database: 'ok',
      ai: false,
      ingest: null,
      stories: { ready: 0, pending: 0, rejected: 0, failed: 0, samples: 0 },
    });
    expect(report.sources?.enabled).toBe(report.sources?.curated);
  });

  it('reports the last run and freshness without error details', async () => {
    await syncSources(testDb.db);
    await testDb.db.update(sources).set({ lastError: 'HTTP 503 from https://secret.example' });
    await testDb.db.insert(ingestRuns).values({
      id: 'r1',
      trigger: 'cron',
      status: 'partial',
      startedAt: ago(60 * 60 * 1000),
      finishedAt: ago(59 * 60 * 1000),
      stats: { new: 4, pending: 3, ready: 2, rejected: 1, failed: 1, backlog: 1, bySource: { x: { error: 'boom' } } },
      error: 'internal detail',
    });
    const report = await getHealthReport({ db: testDb.db, now: NOW, aiEnabled: true });
    expect(report.status).toBe('ok');
    expect(report.ingest).toMatchObject({
      running: false,
      lastRunStatus: 'partial',
      lastRunTrigger: 'cron',
      fresh: true,
      lastRun: { new: 4, pending: 3, ready: 2, rejected: 1, failed: 1, backlog: 1 },
    });
    expect(report.sources?.failing).toBe(report.sources?.curated);
    const json = JSON.stringify(report);
    expect(json).not.toContain('secret.example');
    expect(json).not.toContain('internal detail');
    expect(json).not.toContain('boom');
  });

  it('turns stale when the last success is older than the window', async () => {
    await testDb.db.insert(ingestRuns).values({
      id: 'old',
      trigger: 'scheduler',
      status: 'ok',
      startedAt: ago(FRESHNESS_WINDOW_MS + 120_000),
      finishedAt: ago(FRESHNESS_WINDOW_MS + 60_000),
    });
    const report = await getHealthReport({ db: testDb.db, now: NOW, aiEnabled: false });
    expect(report.status).toBe('degraded');
    expect(report.ingest?.fresh).toBe(false);
  });

  it('is down when the database cannot be reached', async () => {
    const unreachable = {
      select: () => {
        throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      },
    } as unknown as Database;
    const report = await getHealthReport({ db: unreachable, now: NOW, aiEnabled: false });
    expect(report).toEqual({
      status: 'down',
      database: 'unavailable',
      checkedAt: NOW.toISOString(),
      ai: false,
      ingest: null,
      stories: null,
      sources: null,
    });
  });
});
