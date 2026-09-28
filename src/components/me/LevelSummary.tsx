'use client';

import { useLocalState } from '@/components/local/hooks';
import { ProgressLine } from '@/components/pen/marks';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { LocalState } from '@/lib/local/schema';

import { formatCount, levelView } from './me-view';
import { Placeholder } from './Placeholder';

const selectXp = (s: LocalState) => s.xp;

/**
 * The level line on /me (DESIGN §12.7, §11.11): "Storyteller", the level
 * number and XP, then the pen progress line with "140 XP to Wordsmith".
 * Renders same-size placeholders until the store hydrates.
 */
export function LevelSummary() {
  const xp = useLocalState(selectXp);
  const view = xp === null ? null : levelView(xp);
  return (
    <div className="grid gap-3" aria-busy={view === null || undefined}>
      <p className="flex flex-col gap-y-1">
        <span className="font-title text-[26px] leading-[1.15] font-bold tracking-[-0.01em] md:text-[32px]">
          {view ? view.name : <Placeholder sizer="Storyteller" />}
        </span>
        <span className="num text-small font-semibold text-ink-2">
          {view ? (
            <>
              Level {view.number} of {view.total}, {formatCount(view.xp)} XP so far
            </>
          ) : (
            <Placeholder sizer="Level 3 of 7, 560 XP so far" />
          )}
        </span>
      </p>
      {view ? (
        <ProgressBar
          value={view.xp}
          min={view.min}
          max={view.max}
          label={view.toNext}
          name="Progress to the next level"
          labelAfter
          width={240}
          className="max-w-[440px]"
        />
      ) : (
        <div aria-hidden="true" className="flex max-w-[440px] flex-row-reverse items-center justify-end gap-4 text-small font-bold text-ink-2">
          <Placeholder sizer="140 XP to Wordsmith" />
          <span className="block min-w-0 flex-1" style={{ maxWidth: 240 }}>
            <ProgressLine value={0} width="100%" height={12} />
          </span>
        </div>
      )}
    </div>
  );
}
