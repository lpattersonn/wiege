'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cx } from '@/components/ui/cx';

/**
 * The sticky, translucent bar (paper 80% + 12px blur + 8% hairline). Flags
 * `data-scrolled` after 8px so CSS can slim it from 64 to 56px with a
 * transform (no layout shift). Children stay server-rendered.
 */
export function StickyHeader({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      header.dataset.scrolled = window.scrollY > 8 ? 'true' : 'false';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <header
      ref={ref}
      data-sticky=""
      aria-label={label}
      className={cx('site-header translucent-bar sticky top-0 z-40 border-b border-[color-mix(in_srgb,var(--ink)_8%,transparent)]', className)}
    >
      {children}
    </header>
  );
}
