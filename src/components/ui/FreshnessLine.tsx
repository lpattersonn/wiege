'use client';

import { useSyncExternalStore } from 'react';

import { IconClock } from '@/components/glyphs/icons';

import { cx } from './cx';
import { freshnessText, MINUTE } from './freshness';

/** Re-exported for existing imports; server code should import them from `./freshness`. */
export { formatAgo, formatCountdown, freshnessText, nextDropAt } from './freshness';

/**
 * Freshness line (DESIGN §11.21, §14 honest timeliness): clock icon plus
 * "Updated at 12:00. Next drop in 1 h 52 min." (`mode="at"`, landing) or
 * "Updated 2 hours ago. Next drop in 1 h 52 min." (`mode="ago"`, Today).
 * Computed from the real schedule (00/04/08/12/16/20 UTC) and the last
 * successful ingest. When ingest has not succeeded for over 5 hours the
 * countdown is dropped: "Updated 9 hours ago." Updates every minute, also
 * under reduced motion. Renders an empty, same-height line on the server.
 */
export interface FreshnessLineProps {
  /** ISO time of the last successful ingest (IngestSummary.lastSuccessAt). */
  lastSuccessAt: string | null;
  mode?: 'at' | 'ago';
  className?: string;
}

function subscribeMinute(onChange: () => void) {
  const id = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(id);
}
const minuteNow = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const serverNow = () => null;

export function FreshnessLine({ lastSuccessAt, mode = 'ago', className }: FreshnessLineProps) {
  const now = useSyncExternalStore(subscribeMinute, minuteNow, serverNow);
  const text = now === null ? null : freshnessText(lastSuccessAt, now, mode);
  return (
    <p className={cx('flex min-h-6 items-center gap-2 text-small text-ink-2', className)}>
      <IconClock className="shrink-0" />
      {text ? (
        <span>
          {text.lead}
          {text.next ? (
            <>
              {' '}
              Next drop in <b className="num font-bold whitespace-nowrap text-ink">{text.next}</b>.
            </>
          ) : null}
        </span>
      ) : (
        <span aria-hidden="true">&nbsp;</span>
      )}
    </p>
  );
}
