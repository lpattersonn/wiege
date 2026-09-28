import type { CSSProperties } from 'react';

import { cx } from './cx';

/**
 * Skeleton (DESIGN §11.18): --sheet blocks at the exact final size, 4px
 * radius, a 1.6s shimmer (off under reduced motion). Always aria-hidden;
 * pair with a visually hidden "Loading…" only where the wait is long.
 */
export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Pill for count badges and buttons. */
  round?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, round = false, className, style }: SkeletonProps) {
  return <span aria-hidden="true" className={cx('skeleton block', round && 'rounded-pill!', className)} style={{ width, height, ...style }} />;
}

/** Text lines 60–90% wide, each as tall as the line height (keeps the block's height exact). */
export function SkeletonText({ lines = 3, lineHeight = 26, className }: { lines?: number; lineHeight?: number; className?: string }) {
  const widths = ['90%', '76%', '84%', '62%', '88%', '70%'];
  return (
    <span aria-hidden="true" className={cx('grid', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="flex items-center" style={{ height: lineHeight }}>
          <span className="skeleton block" style={{ width: widths[i % widths.length], height: Math.round(lineHeight * 0.6) }} />
        </span>
      ))}
    </span>
  );
}
