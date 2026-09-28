import { getHealthReport } from '@/lib/news/status';

/**
 * `GET /api/health` (SPEC §8): public service status (database, last ingest,
 * story counts). No secrets. Healthy answers may be shared by a CDN for 30
 * seconds so monitors cannot hammer the database; failures are never cached.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const report = await getHealthReport();
  const down = report.status === 'down';
  return Response.json(report, {
    status: down ? 503 : 200,
    headers: { 'Cache-Control': down ? 'no-store' : 'public, max-age=0, s-maxage=30' },
  });
}
