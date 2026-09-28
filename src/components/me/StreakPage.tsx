'use client';

import { useStreak } from '@/components/local/hooks';
import { Tally } from '@/components/pen/marks';

import { streakView } from './me-view';
import { Placeholder } from './Placeholder';

/**
 * The big streak (DESIGN §11.13): an Atkinson 800 numeral with "days in a
 * row", the 72px tally (today's pending stroke dashed) and a caption. A broken
 * or not-yet-started streak never shows a zero in big type. Every part has a
 * fixed box so the hydrated values replace the placeholders without a shift.
 */
export function StreakPage({ headingId }: { headingId: string }) {
  const summary = useStreak();
  const view = summary ? streakView(summary) : null;

  return (
    <div aria-busy={view === null || undefined}>
      <h2 id={headingId} className="type-h3">
        Days you read
      </h2>

      {/* The invisible sizer reserves the numeral's box in every state. */}
      <div className="mt-6 grid">
        <p aria-hidden="true" className="invisible [grid-area:1/1]">
          <span className="block type-numeral-xl">12</span>
          <span className="mt-2 block text-[17px] leading-6 font-bold">days in a row</span>
        </p>
        <div className="grid content-end [grid-area:1/1]">
          {view === null ? (
            <p key="placeholder" aria-hidden="true">
              <span className="block type-numeral-xl">
                <Placeholder sizer="12" />
              </span>
              <span className="mt-2 block text-[17px] leading-6 font-bold">
                <Placeholder sizer="days in a row" />
              </span>
            </p>
          ) : view.kind === 'active' ? (
            <p key="active">
              <span className="block type-numeral-xl">{view.count}</span>
              <span className="mt-2 block text-[17px] leading-6 font-bold">{view.unit}</span>
            </p>
          ) : (
            <p key="headline" className="type-h3 pb-1">
              {view.headline}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex h-[72px] items-center">
        {view ? (
          <Tally count={view.tally.count} pending={view.tally.pending} label={view.tally.label} className="h-[72px] w-auto max-w-full" />
        ) : null}
      </div>

      <p className="mt-4 min-h-[52px] max-w-[44ch] text-ui text-ink-2">{view ? view.caption : <Placeholder sizer="Read one story today to make it 13." />}</p>
    </div>
  );
}
