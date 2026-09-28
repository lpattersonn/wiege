import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetEnvCache } from '@/lib/env';

import type { IngestResult } from './ingest';
import type { HealthReport } from './status';

const mocks = vi.hoisted(() => ({
  runIngest: vi.fn<(opts: { trigger: string; budgetMs?: number }) => Promise<IngestResult>>(),
  revalidateStoryPages: vi.fn(() => true),
  getHealthReport: vi.fn<() => Promise<HealthReport>>(),
}));

vi.mock('@/lib/news/ingest', () => ({ runIngest: mocks.runIngest }));
vi.mock('@/lib/news/revalidate', () => ({ revalidateStoryPages: mocks.revalidateStoryPages }));
vi.mock('@/lib/news/status', () => ({ getHealthReport: mocks.getHealthReport }));

const cron = await import('@/app/api/cron/ingest/route');
const health = await import('@/app/api/health/route');

const SECRET = 'a-long-random-cron-secret-value';
const ORIGINAL_SECRET = process.env.CRON_SECRET;

function cronRequest(query = '', headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }, method = 'POST') {
  return new NextRequest(`https://wiege.example/api/cron/ingest${query}`, { method, headers });
}

const okResult: IngestResult = { status: 'ok', runId: 'run-1', stats: { fetched: 10, new: 4, ready: 3, bySource: { x: {} } } };

describe('/api/cron/ingest', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    resetEnvCache();
    mocks.runIngest.mockReset().mockResolvedValue(okResult);
    mocks.revalidateStoryPages.mockClear();
  });

  afterAll(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
    resetEnvCache();
  });

  it('refuses requests without the bearer secret', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await cron.POST(cronRequest('', {}));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.runIngest).not.toHaveBeenCalled();
  });

  it('runs a cron ingest, then revalidates story pages (GET and POST)', async () => {
    for (const method of ['GET', 'POST'] as const) {
      const response = await cron[method](cronRequest('', { authorization: `Bearer ${SECRET}` }, method));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok', runId: 'run-1', revalidated: true, stats: { fetched: 10, new: 4, ready: 3 } });
    }
    expect(mocks.runIngest).toHaveBeenCalledWith({ trigger: 'cron', budgetMs: undefined });
    expect(mocks.revalidateStoryPages).toHaveBeenCalledTimes(2);
  });

  it('only revalidates with ?revalidateOnly=1', async () => {
    const response = await cron.POST(cronRequest('?revalidateOnly=1'));
    expect(await response.json()).toEqual({ revalidated: true });
    expect(mocks.runIngest).not.toHaveBeenCalled();
    expect(mocks.revalidateStoryPages).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed query', async () => {
    const response = await cron.POST(cronRequest('?revalidateOnly=maybe'));
    expect(response.status).toBe(400);
  });

  it('reports failures with 500 and skips revalidation when nothing ran', async () => {
    mocks.runIngest.mockResolvedValueOnce({ status: 'failed', runId: null, stats: { error: 'db down' } });
    expect((await cron.POST(cronRequest())).status).toBe(500);
    mocks.runIngest.mockResolvedValueOnce({ status: 'skipped', runId: null, stats: { reason: 'another ingest run is in progress' } });
    const skipped = await cron.POST(cronRequest());
    expect(skipped.status).toBe(200);
    expect(await skipped.json()).toMatchObject({ status: 'skipped', revalidated: false });
    expect(mocks.revalidateStoryPages).not.toHaveBeenCalled();
  });

  it('declares route segment config for a long, never-cached handler', () => {
    expect(cron.dynamic).toBe('force-dynamic');
    expect(cron.maxDuration).toBe(60);
  });
});

describe('/api/health', () => {
  const report = (status: HealthReport['status']): HealthReport => ({
    status,
    checkedAt: '2026-09-27T12:00:00.000Z',
    database: status === 'down' ? 'unavailable' : 'ok',
    ai: false,
    ingest: null,
    stories: null,
    sources: null,
  });

  it('answers 200 and lets a CDN share healthy answers briefly', async () => {
    mocks.getHealthReport.mockResolvedValueOnce(report('degraded'));
    const response = await health.GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=30');
    expect(await response.json()).toMatchObject({ status: 'degraded' });
  });

  it('answers 503 without caching when the database is down', async () => {
    mocks.getHealthReport.mockResolvedValueOnce(report('down'));
    const response = await health.GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
