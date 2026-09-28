'use client';

import { useState } from 'react';

import { useReadRecord } from '@/components/local/hooks';
import { MiniTick } from '@/components/pen/marks';
import { Button } from '@/components/ui/Button';
import { dispatch } from '@/lib/local/store';

import { announce } from './celebrate';
import { useReader } from './ReaderRoot';

/**
 * "I finished reading" (SPEC §8): marks the story done on this device
 * without the quiz (+10 XP the first time). Both states share one 48px row,
 * so swapping after hydration shifts nothing; the tick draws in only when the
 * student just pressed the button.
 */
export function FinishReading() {
  const { story, level } = useReader();
  const record = useReadRecord(story.slug);
  const [justFinished, setJustFinished] = useState(false);
  const done = Boolean(record && record.completedAt !== undefined);

  function finish() {
    const events = dispatch({ type: 'completeRead', slug: story.slug, title: story.titles[level], category: story.category, level });
    setJustFinished(true);
    announce(events.xpGained > 0 ? `Story finished. +${events.xpGained} XP.` : 'Story finished.', events);
  }

  return (
    <div className="mt-10 flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2" aria-live="polite">
      {done ? (
        <p className="flex min-h-12 items-center gap-3 text-ui leading-snug font-bold text-ink">
          <MiniTick size={20} animate={justFinished} />
          You finished this story.
        </p>
      ) : (
        <>
          <Button variant="secondary" onClick={finish}>
            I finished reading
          </Button>
          <p className="text-small leading-snug text-ink-2">Or answer the questions below. They count too.</p>
        </>
      )}
    </div>
  );
}
