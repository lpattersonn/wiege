'use client';

import { useLayoutEffect, useRef } from 'react';

import { drawIn } from '@/components/pen/draw';
import { PenMark } from '@/components/pen/PenMark';
import { doublePath, penSeed } from '@/components/pen/pen';
import { cx } from '@/components/ui/cx';

import { splitDraft, type DraftMark } from './feedback-marks';

/**
 * The draft as text with pen marks (DESIGN §11.12): a `double` underline under
 * a quoted strong phrase, a `loop` around a single word, a `caret` at a
 * suggested insertion point. Each marked span points at its note with
 * aria-describedby. The student's text is shown exactly as written.
 *
 * Phrase underlines can wrap across lines, so they are measured: one
 * hand-drawn double line per line fragment, redrawn when the column resizes.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export const DRAFT_TEXT = 'draft font-read text-[19px] leading-[1.9] text-ink-read md:text-[20px]';

function drawPhraseMarks(container: HTMLElement, overlay: HTMLElement, scope: string, animate: boolean): Animation[] {
  overlay.replaceChildren();
  const base = container.getBoundingClientRect();
  const fs = parseFloat(getComputedStyle(container).fontSize) || 20;
  const running: Animation[] = [];
  container.querySelectorAll<HTMLElement>('[data-mk="double"]').forEach((span, spanIndex) => {
    Array.from(span.getClientRects()).forEach((rect, line) => {
      if (rect.width < 4) return;
      const svg = document.createElementNS(SVG_NS, 'svg');
      const geometry = doublePath(penSeed('double', `${span.textContent ?? ''}:${line}`, scope));
      svg.setAttribute('viewBox', geometry.viewBox);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.setAttribute('class', 'pm-static');
      Object.assign(svg.style, {
        position: 'absolute',
        left: `${rect.left - base.left - 0.04 * fs}px`,
        top: `${rect.bottom - base.top - 0.08 * fs}px`,
        width: `${rect.width + 0.08 * fs}px`,
        height: `${0.42 * fs}px`,
      });
      svg.style.setProperty('--pen-scale', '1.05');
      for (const d of geometry.d) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
      }
      overlay.appendChild(svg);
      if (animate) running.push(...drawIn(svg, { delay: spanIndex * 180 + line * 120 }));
    });
  });
  return running;
}

export interface MarkedDraftProps {
  body: string;
  marks: readonly DraftMark[];
  /** Note id for a mark's note key. */
  noteId: (key: string) => string;
  /** Hide the marks (the student chose "Hide notes"). */
  hidden: boolean;
  /** Draw the marks in (only right after the student asked for notes). */
  animate: boolean;
  /** Seed scope (the entry id), so the same draft always gets the same marks. */
  scope: string;
  className?: string;
}

export function MarkedDraft({ body, marks, noteId, hidden, animate, scope, className }: MarkedDraftProps) {
  const ref = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const segments = splitDraft(body, hidden ? [] : marks);

  useLayoutEffect(() => {
    const container = ref.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;
    let running = drawPhraseMarks(container, overlay, scope, animate);
    let frame = 0;
    let lastWidth = container.clientWidth;
    const redraw = () => {
      frame = 0;
      running.forEach((a) => a.finish());
      running = drawPhraseMarks(container, overlay, scope, false);
    };
    const observer = new ResizeObserver(() => {
      if (container.clientWidth === lastWidth) return;
      lastWidth = container.clientWidth;
      if (!frame) frame = requestAnimationFrame(redraw);
    });
    observer.observe(container);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive && !frame) frame = requestAnimationFrame(redraw);
    });
    return () => {
      alive = false;
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      running.forEach((a) => a.cancel());
      overlay.replaceChildren();
    };
  }, [body, marks, hidden, animate, scope]);

  return (
    <div
      ref={ref}
      className={cx(
        DRAFT_TEXT,
        'relative min-h-[calc(8lh+34px)] max-w-[36em] rounded-control border-[1.5px] border-line-control px-5 pt-4 pb-6 break-words whitespace-pre-wrap',
        className,
      )}
    >
      {segments.map((segment, i) => {
        const mark = segment.mark;
        if (!mark) return <span key={i}>{segment.text}</span>;
        const describedBy = noteId(mark.noteKey);
        if (mark.kind === 'double') {
          return (
            <span key={i} data-mk="double" aria-describedby={describedBy}>
              {segment.text}
            </span>
          );
        }
        if (mark.kind === 'loop') {
          return (
            <span key={i} className="mk marked" data-pen-context="read" aria-describedby={describedBy}>
              {segment.text}
              <PenMark kind="loop" word={segment.text} scope={scope} font="read" context="read" scale={1.05} animate={animate} />
            </span>
          );
        }
        return (
          <span key={i} className="mk marked leading-[1.2]" aria-describedby={describedBy}>
            {'​'}
            <PenMark kind="caret" word={`caret-${mark.start}`} scope={scope} animate={animate} delay={300} />
          </span>
        );
      })}
      <div ref={overlayRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />
    </div>
  );
}
