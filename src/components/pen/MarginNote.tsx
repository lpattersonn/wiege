'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

import { cx } from '@/components/ui/cx';

import { drawPath, PEN_DURATION } from './draw';
import { Bracket } from './marks';
import { leaderPath } from './pen';

/**
 * A pen note (DESIGN §8.7): a bracket down the left edge (26px padding),
 * UI type 17/1.5, max 42ch. Used for word notes, quiz explanations and
 * writing feedback.
 *
 * - `placement="margin"` (≥ 1024px): render it inside <FolioMargin>. It is
 *   placed absolutely at the tapped word's top − 4px, the column grows to fit,
 *   and a pen leader arrow runs from the note back to the end of the word's
 *   line. Positions are recomputed on fonts.ready, on resize of the folio and
 *   when the anchor changes (debounced 120ms).
 * - `placement="inline"` (< 1024px): in flow, 24px above and below; no arrow.
 *   Insert it directly after the block that holds the word.
 *
 * Keep it mounted (it is the aria-controls target); `open` toggles it.
 * Opening another word swaps the content with a 160ms fade (`swapKey`).
 */
export interface MarginNoteProps {
  id: string;
  open: boolean;
  /** The tapped word or marked span the note belongs to. */
  anchor?: HTMLElement | null;
  placement?: 'margin' | 'inline';
  /** Draw the leader arrow (margin placement only). */
  leader?: boolean;
  /** Draw the leader and fade the note in (the student just opened it). */
  animate?: boolean;
  /** Changes when the content changes, to replay the fade. */
  swapKey?: string | number;
  /** 'region' + aria-live polite (word notes) or 'status' (quiz feedback). */
  role?: 'region' | 'status';
  /**
   * Announce content changes (aria-live="polite"). Default true. Pass false
   * while a note was opened by the page rather than the student (the landing
   * hero's pre-open), so screen readers don't read it out unasked.
   */
  live?: boolean;
  label?: string;
  className?: string;
  children: ReactNode;
}

function lineEndOf(anchor: HTMLElement): number {
  const a = anchor.getBoundingClientRect();
  const block = anchor.closest('p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption') ?? anchor.parentElement;
  let end = a.right;
  if (block) {
    const range = document.createRange();
    range.selectNodeContents(block);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width && rect.top < a.bottom - 4 && rect.bottom > a.top + 4) end = Math.max(end, rect.right);
    }
    range.detach?.();
  }
  return end;
}

export function MarginNote({ id, open, anchor, placement = 'margin', leader = true, animate = false, swapKey, role = 'region', live = true, label = 'Word note', className, children }: MarginNoteProps) {
  const noteRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const note = noteRef.current;
    if (!note) return;
    const margin = note.parentElement;
    if (placement !== 'margin' || !open || !anchor || !margin) {
      note.style.top = '';
      lineRef.current?.removeAttribute('d');
      headRef.current?.removeAttribute('d');
      return;
    }
    const folio = note.closest<HTMLElement>('[data-folio]');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const place = (draw: boolean) => {
      if (cancelled || !anchor.isConnected) return;
      const m = margin.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      const top = Math.max(0, a.top - m.top - 4);
      note.style.top = `${top}px`;
      margin.style.minHeight = `${Math.ceil(top + note.offsetHeight + 8)}px`;
      if (!leader || !lineRef.current || !headRef.current) return;
      const n = note.getBoundingClientRect();
      const main = folio?.querySelector<HTMLElement>('[data-folio-main]')?.getBoundingClientRect();
      const yWord = a.top - n.top + a.height * 0.52;
      const xEnd = lineEndOf(anchor) - n.left + 18;
      const x2 = main ? Math.min(xEnd, main.right - n.left + 24) : xEnd;
      const path = leaderPath(-8, 22, x2, yWord);
      if (!path) {
        lineRef.current.removeAttribute('d');
        headRef.current.removeAttribute('d');
        return;
      }
      lineRef.current.setAttribute('d', path.line);
      headRef.current.setAttribute('d', path.head);
      if (draw) {
        drawPath(lineRef.current, { delay: PEN_DURATION.arrowDelay, duration: PEN_DURATION.arrow });
        drawPath(headRef.current, { delay: PEN_DURATION.arrowDelay + PEN_DURATION.arrow, duration: PEN_DURATION.arrowHead });
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => place(false), 120);
    };

    place(animate);
    const observer = new ResizeObserver(schedule);
    observer.observe(folio ?? document.body);
    observer.observe(note);
    window.addEventListener('resize', schedule);
    document.fonts?.ready.then(() => place(false)).catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      margin.style.minHeight = '';
    };
  }, [open, anchor, placement, leader, animate, swapKey]);

  const isMargin = placement === 'margin';
  return (
    <div
      ref={noteRef}
      id={id}
      role={role}
      aria-label={role === 'region' ? label : undefined}
      aria-live={live ? 'polite' : 'off'}
      hidden={!open}
      className={cx(
        'relative max-w-[42ch] pt-0.5 pb-1 pl-[26px] font-ui text-ui leading-normal text-ink',
        isMargin ? 'lg:absolute lg:inset-x-0' : 'my-6',
        className,
      )}
    >
      <Bracket />
      {isMargin && leader ? (
        <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute top-0 left-0 hidden size-px overflow-visible lg:block">
          <path ref={lineRef} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ strokeWidth: 'calc(var(--pen-w) * .9)' }} />
          <path ref={headRef} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ strokeWidth: 'calc(var(--pen-w) * .9)' }} />
        </svg>
      ) : null}
      <div key={swapKey} className={animate ? 'fade-in' : undefined}>
        {children}
      </div>
    </div>
  );
}
