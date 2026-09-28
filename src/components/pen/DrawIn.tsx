'use client';

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

import { drawIn, type DrawOptions } from './draw';

/**
 * Plays the pen draw-in on the SVG(s) inside it when it mounts, or whenever
 * `playKey` changes. Wrap only marks the student just created (a tap, a save,
 * a grade): server-rendered marks must stay still. Renders a `display:
 * contents` span, so it never affects layout.
 */
export function DrawIn({ children, playKey, delay, duration, stagger, only }: DrawOptions & { children: ReactNode; playKey?: string | number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const svgs = host.querySelectorAll<SVGSVGElement>('svg');
    const running = Array.from(svgs).flatMap((svg) => drawIn(svg, { delay, duration, stagger, only }));
    return () => running.forEach((a) => a.cancel());
  }, [playKey, delay, duration, stagger, only]);
  return (
    <span ref={ref} style={{ display: 'contents' }}>
      {children}
    </span>
  );
}

/**
 * Hook form: draws the SVG at `ref` when `play` turns true (and again when
 * `playKey` changes while playing).
 */
export function usePenDraw(ref: RefObject<SVGSVGElement | null>, { play = true, playKey, ...options }: DrawOptions & { play?: boolean; playKey?: string | number } = {}) {
  const { delay, duration, stagger, only } = options;
  useLayoutEffect(() => {
    if (!play || !ref.current) return;
    const running = drawIn(ref.current, { delay, duration, stagger, only });
    return () => running.forEach((a) => a.cancel());
  }, [ref, play, playKey, delay, duration, stagger, only]);
}
