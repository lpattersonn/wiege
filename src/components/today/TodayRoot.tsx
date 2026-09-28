'use client';

import { useCallback, type ReactNode } from 'react';

import { InlineScript } from '@/components/local/InlineScript';
import { cx } from '@/components/ui/cx';
import type { LocalState } from '@/lib/local/schema';
import { useLocal } from '@/lib/local/store';

import { firstVisitFlags, flagAttributes, todayFlags, type PickCandidate, type TodayFlags } from './today-model';

const sameFlags = (a: TodayFlags, b: TodayFlags) =>
  a.isNew === b.isNew && a.cont === b.cont && a.due === b.due && a.pick === b.pick && a.why === b.why;

/**
 * The Today root (`group/today`). It carries the layout flags as data
 * attributes (new visitor, Continue reading rows, words due, the pick) that
 * the page's CSS lays out from.
 *
 * - Hard load: the server HTML has the first-visit flags; `script` (built by
 *   todayScript on the server) runs as the first child, before anything below
 *   is parsed, and rewrites them from localStorage. React hydrates without
 *   touching them (suppressHydrationWarning), then renders the same values.
 * - Client navigation: the store is already loaded, so React renders the real
 *   flags on the first render (the script is inert there).
 */
export function TodayRoot({
  candidates,
  fallback,
  script,
  className,
  children,
}: {
  candidates: PickCandidate[];
  /** Today's story on a first visit (index into candidates). */
  fallback: number;
  script: string;
  className?: string;
  children: ReactNode;
}) {
  const select = useCallback((state: LocalState) => todayFlags(state, Date.now(), candidates, fallback), [candidates, fallback]);
  const flags = useLocal(select, sameFlags) ?? firstVisitFlags(fallback);
  return (
    <div data-today="" className={cx('group/today', className)} {...flagAttributes(flags)} suppressHydrationWarning>
      <InlineScript html={script} />
      {children}
    </div>
  );
}
