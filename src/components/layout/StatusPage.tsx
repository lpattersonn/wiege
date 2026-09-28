import type { ReactNode } from 'react';

import { PenMark } from '@/components/pen/PenMark';
import { cx } from '@/components/ui/cx';

/**
 * The 404 / error / "story has moved on" layout (DESIGN §12.10): a centred
 * 560 column, 128px top padding (64 mobile), a big Bodoni 900 word (96, 56
 * mobile) wearing a pen mark, the h1, one line of --ink-2 and one action.
 */
export interface StatusPageProps {
  /** The big decorative word ("moved", "hiccup"). */
  word: string;
  /** Pen mark on the word: loop (404) or cross (error). */
  mark?: 'loop' | 'cross';
  title: string;
  children: ReactNode;
  action: ReactNode;
  className?: string;
}

export function StatusPage({ word, mark = 'loop', title, children, action, className }: StatusPageProps) {
  return (
    <div className={cx('mx-auto grid max-w-[calc(560px+2*var(--gutter))] justify-items-start px-(--gutter) pt-16 pb-24 md:pt-32', className)}>
      <p aria-hidden="true" className="font-display text-[56px] leading-[1.04] font-black tracking-[-0.02em] md:text-[96px]">
        <span className={cx('marked', mark === 'loop' && 'dotted')} data-pen-context="display">
          {word}
          {mark === 'loop' ? (
            <PenMark kind="loop" word={word} scope="status" font="display-900" context="display" scale={1.75} />
          ) : (
            <span className="absolute inset-y-[-6%] left-[18%] block w-[64%]">
              <PenMark kind="cross" word={word} scope="status" scale={1.75} />
            </span>
          )}
        </span>
      </p>
      <h1 className="mt-10 type-h1">{title}</h1>
      <p className="mt-3 text-ui leading-normal text-ink-2">{children}</p>
      <div className="mt-8">{action}</div>
    </div>
  );
}
