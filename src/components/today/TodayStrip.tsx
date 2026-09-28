'use client';

import type { ReactNode } from 'react';

import { useProgressTotals } from '@/components/local/hooks';
import { MiniTally } from '@/components/pen/marks';
import { cx } from '@/components/ui/cx';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * The Today strip (DESIGN §11.13 compact form, §12.2): reading days with a
 * mini tally, words saved and due, and the level line. Each item is one
 * fixed-height line that never wraps, and from 1024px of content each sits in
 * a fixed-width slot (sized for the longest real text, measured). So no item
 * starts anywhere else when the placeholders turn into real numbers: three
 * stacked rows below 1024px, one right-aligned row beside the greeting above
 * (two rows at most, still shorter than the heading).
 */
const ROW = 'flex h-6 min-w-0 items-center gap-2 whitespace-nowrap';
const SLOT = ['@5xl/app:w-[212px]', '@5xl/app:w-[188px]', '@5xl/app:w-[232px]'] as const;

export function TodayStrip() {
  const totals = useProgressTotals();

  let streak: ReactNode = <Skeleton width={150} height={14} />;
  let words: ReactNode = <Skeleton width={170} height={14} />;
  let level: ReactNode = <Skeleton width={220} height={14} />;

  if (totals) {
    const { currentStreak, bestStreak, wordsCollected, wordsDue, level: lp } = totals;
    streak =
      currentStreak > 0 ? (
        <>
          <MiniTally count={Math.min(currentStreak, 15)} className="shrink-0" />
          <span className="truncate">
            <b className="font-extrabold text-ink">
              <span className="num">{currentStreak}</span> {currentStreak === 1 ? 'day' : 'days'}
            </b>{' '}
            in a row
          </span>
        </>
      ) : (
        <span className="truncate">{bestStreak > 0 ? 'Start a new line today' : 'Read a story to start your streak'}</span>
      );
    words = (
      <span className="truncate">
        <b className="font-extrabold text-ink">
          <span className="num">{wordsCollected}</span> {wordsCollected === 1 ? 'word' : 'words'}
        </b>
        {wordsCollected === 0 ? ' saved so far' : wordsDue > 0 ? <>, <span className="num">{wordsDue}</span> to practise</> : ' saved'}
      </span>
    );
    level = (
      <span className="truncate">
        <b className="font-extrabold text-ink">{lp.level.name}</b>
        {lp.next && lp.xpToNext !== null ? (
          <>
            , <span className="num">{lp.xpToNext}</span> XP to {lp.next.name}
          </>
        ) : (
          ', the top level'
        )}
      </span>
    );
  }

  return (
    <ul
      aria-label="Your progress on this device"
      className="grid gap-3 text-small leading-6 font-normal text-ink-2 @5xl/app:flex @5xl/app:flex-wrap @5xl/app:justify-end @5xl/app:gap-x-4 @5xl/app:gap-y-2"
    >
      <li className={cx(ROW, SLOT[0])}>{streak}</li>
      <li className={cx(ROW, SLOT[1])}>{words}</li>
      <li className={cx(ROW, SLOT[2])}>{level}</li>
    </ul>
  );
}
