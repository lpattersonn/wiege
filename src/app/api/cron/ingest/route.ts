import type { NextRequest } from 'next/server';

import { getEnv } from '@/lib/env';
import { authorizeCronRequest, cronBudgetMs, parseCronQuery } from '@/lib/news/cron';
import { runIngest } from '@/lib/news/ingest';
import { revalidateStoryPages } from '@/lib/news/revalidate';

/**
 * `GET|POST /api/cron/ingest` (SPEC §5): runs one time-budgeted ingest, then
 * marks story pages stale. `?revalidateOnly=1` skips the ingest (used after a
 * CLI run, e.g. from GitHub Actions or the in-process scheduler).
 * Requires `Authorization: Bearer $CRON_SECRET`; Vercel Cron sends it
 * automatically. In development, localhost may call it without a secret.
 */

// Never cache or prerender: every call must run.
export const dynamic = 'force-dynamic';
// Netlify caps synchronous functions at 60 s; the run itself stops starting work at its budget.
export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const SUMMARY_KEYS = [
  'fetched',
  'new',
  'pending',
  'rejected',
  'deferred',
  'ready',
  'failed',
  'backlog',
  'sourceErrors',
  'sourcesSkipped',
  'durationMs',
] as const;

function summarize(stats: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const key of [...SUMMARY_KEYS, 'classifier', 'stoppedBy', 'reason']) {
    if (stats[key] !== undefined) summary[key] = stats[key];
  }
  return summary;
}

async function handle(request: NextRequest): Promise<Response> {
  const env = getEnv();
  const auth = authorizeCronRequest(request, { secret: env.CRON_SECRET, nodeEnv: env.NODE_ENV });
  if (!auth.ok) {
    if (auth.reason === 'not-configured') console.error('[cron] request refused: CRON_SECRET is not set');
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: { ...NO_STORE, 'WWW-Authenticate': 'Bearer' } });
  }

  const query = parseCronQuery(request.nextUrl.searchParams);
  if (!query) {
    return Response.json({ error: 'revalidateOnly must be 1 or 0' }, { status: 400, headers: NO_STORE });
  }
  if (query.revalidateOnly) {
    return Response.json({ revalidated: revalidateStoryPages() }, { headers: NO_STORE });
  }

  const result = await runIngest({ trigger: 'cron', budgetMs: cronBudgetMs() });
  const revalidated = result.status === 'ok' || result.status === 'partial' ? revalidateStoryPages() : false;
  return Response.json(
    { status: result.status, runId: result.runId, revalidated, stats: summarize(result.stats) },
    { status: result.status === 'failed' ? 500 : 200, headers: NO_STORE },
  );
}

export function GET(request: NextRequest): Promise<Response> {
  return handle(request);
}

export function POST(request: NextRequest): Promise<Response> {
  return handle(request);
}
