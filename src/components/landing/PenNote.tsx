import type { ReactNode } from 'react';

import { Bracket } from '@/components/pen/marks';
import { cx } from '@/components/ui/cx';

/**
 * A static margin note for the landing's examples (DESIGN §8.7 anatomy): the
 * pen bracket down the left edge, 26px in, UI type 17/1.5, max 42ch. Unlike
 * <MarginNote> it is plain server HTML in the flow of the margin column, so it
 * costs no JavaScript. Below 1024px the folio stacks it under its block.
 */
export function PenNote({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('relative max-w-[42ch] pt-0.5 pb-1 pl-[26px] font-ui text-ui leading-normal text-ink', className)}>
      <Bracket />
      {title ? <p className="font-title text-[26px] leading-[1.1] font-bold text-balance">{title}</p> : null}
      <div className={title ? 'mt-3' : undefined}>{children}</div>
    </div>
  );
}

/** Renders "quoted" parts of a feedback note as quotes in Literata italic (DESIGN §11.12). */
export function QuotedText({ text }: { text: string }) {
  const parts = text.split(/"([^"]+)"/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <q key={i} className="font-read italic">
            {part}
          </q>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
