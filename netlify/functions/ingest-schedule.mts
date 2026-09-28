/**
 * Netlify Scheduled Function (SPEC §5): every 4 hours, asks the site to run
 * one time-budgeted ingest through `/api/cron/ingest`.
 *
 * Scheduled functions may run for 30 seconds. The ingest route stops starting
 * new work when its budget (20 s by default) is spent, so this waits up to
 * 28 s; if it stops waiting first, the run still finishes on the server.
 * `URL` is provided by Netlify; set `CRON_SECRET` in the site's environment.
 */
export default async function ingestSchedule(): Promise<Response> {
  const siteUrl = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!siteUrl || !secret) {
    console.error('[ingest-schedule] URL or CRON_SECRET is not set; nothing was triggered');
    return new Response('not configured', { status: 500 });
  }

  try {
    const response = await fetch(new URL('/api/cron/ingest', siteUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'User-Agent': 'WiegeScheduler/1.0 (Netlify)' },
      signal: AbortSignal.timeout(28_000),
    });
    const body = (await response.text()).slice(0, 1_000);
    console.log(`[ingest-schedule] HTTP ${response.status} ${body}`);
    return new Response(null, { status: response.ok ? 204 : 502 });
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[ingest-schedule] request did not complete (${reason}); a started run finishes on the server`);
    return new Response(null, { status: 504 });
  }
}

export const config = {
  schedule: '0 */4 * * *',
};
