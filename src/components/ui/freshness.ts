/**
 * Freshness maths (DESIGN §11.21, §14 honest timeliness), isomorphic: the
 * real ingest schedule is 00/04/08/12/16/20 UTC. Import from here in server
 * code; <FreshnessLine> (a client island) uses the same functions.
 */
export const MINUTE = 60_000;
const DROP_HOURS = 4;

export function nextDropAt(now: number): number {
  const d = new Date(now);
  const slot = Math.floor(d.getUTCHours() / DROP_HOURS) * DROP_HOURS;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), slot) + DROP_HOURS * 3_600_000;
}

export function formatCountdown(ms: number): string {
  const mins = Math.max(1, Math.round(ms / MINUTE));
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
}

export function formatAgo(ms: number): string {
  const mins = Math.max(0, Math.round(ms / MINUTE));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

export function freshnessText(lastSuccessAt: string | null, now: number, mode: 'at' | 'ago'): { lead: string; next: string | null } {
  const next = formatCountdown(nextDropAt(now) - now);
  if (!lastSuccessAt) return { lead: 'New stories every four hours.', next };
  const last = Date.parse(lastSuccessAt);
  if (Number.isNaN(last)) return { lead: 'New stories every four hours.', next };
  const age = now - last;
  if (age > 5 * 3_600_000) return { lead: `Updated ${formatAgo(age)}.`, next: null };
  const lead =
    mode === 'at'
      ? `Updated at ${new Date(last).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
      : `Updated ${formatAgo(age)}.`;
  return { lead, next };
}

