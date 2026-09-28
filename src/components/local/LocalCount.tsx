'use client';

import Link from 'next/link';

import { MiniTick } from '@/components/pen/marks';
import { CountPill } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';

import { useLocal } from '@/lib/local/store';
import type { LocalState } from '@/lib/local/schema';
import { isDue } from '@/lib/progress/leitner';
import { streakSummary } from '@/lib/progress/streak';
import { dayKey } from '@/lib/time';

import { useIsRead, useWordCount } from './hooks';

/**
 * Small on-device islands. Each renders a same-size placeholder until the
 * store hydrates (its server snapshot is null), so nothing shifts.
 */

export type LocalCountKind = 'words' | 'dueWords' | 'streak' | 'bestStreak' | 'storiesRead' | 'journalEntries' | 'xp';

const now = () => Date.now();
const today = (s: LocalState) => dayKey(now(), s.prefs.timezone);

const SELECTORS: Record<LocalCountKind, (s: LocalState) => number> = {
  words: (s) => Object.keys(s.words).length,
  dueWords: (s) => {
    const t = now();
    let n = 0;
    for (const w of Object.values(s.words)) if (isDue(w, t)) n++;
    return n;
  },
  streak: (s) => streakSummary(s.activity, today(s), s.longestStreak).current,
  bestStreak: (s) => streakSummary(s.activity, today(s), s.longestStreak).longest,
  storiesRead: (s) => Object.values(s.reads).filter((r) => r.completedAt !== undefined).length,
  journalEntries: (s) => Object.values(s.journal).filter((e) => e.wordCount > 0).length,
  xp: (s) => s.xp,
};

function useCount(kind: LocalCountKind): number | null {
  return useLocal(SELECTORS[kind]);
}

/**
 * A live number from the device: `<LocalCount kind="words" />`. Tabular
 * Atkinson; before hydration a figure space holds `minDigits` of width.
 */
export function LocalCount({ kind, minDigits = 1, className }: { kind: LocalCountKind; minDigits?: number; className?: string }) {
  const value = useCount(kind);
  return (
    <span className={cx('num inline-block', className)} style={{ minWidth: `${minDigits}ch` }}>
      {value ?? ' '.repeat(minDigits)}
    </span>
  );
}

/** Count pill bound to the store (nav Words count, tab-bar due badge). Ticks on change. */
export function LocalCountPill({ kind, size = 28, className }: { kind: LocalCountKind; size?: 28 | 24 | 18; className?: string }) {
  const value = useCount(kind);
  return <CountPill value={value} size={size} tick className={className} />;
}

/**
 * The nav "Words" link with its live count pill (DESIGN §11.8), labelled
 * "Your words: N saved". `variant="app"` is the 44px app-nav pill link.
 */
export function WordsNavLink({ href = '/words', variant = 'site', current = false, onClick, className }: { href?: string; variant?: 'site' | 'app' | 'drawer'; current?: boolean; onClick?: () => void; className?: string }) {
  const count = useWordCount();
  const label = count === null ? 'Your words' : `Your words: ${count} saved`;
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-11 items-center gap-2 font-bold text-ink no-underline',
        variant === 'site' && 'text-nav hover:underline hover:decoration-2 hover:underline-offset-[6px]',
        variant === 'app' && cx('rounded-pill px-4 text-small', current ? 'bg-sheet text-ink' : 'text-ink-2 hover:bg-sheet hover:text-ink'),
        variant === 'drawer' && 'min-h-12 w-full justify-between text-choice',
        className,
      )}
    >
      Words
      <CountPill value={count} size={variant === 'app' ? 24 : 28} tick />
    </Link>
  );
}

/**
 * "Read" marker for story cards and lists: a pen tick plus "Read" (14px 700
 * --ink-3). Its space is always reserved (hidden until the story is done on
 * this device), so cards never shift.
 */
export function ReadMarker({ slug, className }: { slug: string; className?: string }) {
  const done = useIsRead(slug) === true;
  return (
    <span
      className={cx('inline-flex items-center gap-2 text-caption leading-none font-bold whitespace-nowrap text-ink-3', className)}
      style={{ visibility: done ? 'visible' : 'hidden' }}
      aria-hidden={!done || undefined}
    >
      <MiniTick size={14} />
      Read
    </span>
  );
}
