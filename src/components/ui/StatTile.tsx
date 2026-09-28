import type { ReactNode } from 'react';

import { ProgressLine } from '@/components/pen/marks';

import { cx } from './cx';

/**
 * Stat tile (DESIGN §11.14): 1px --line-soft border, 4px radius, 20px
 * padding. Value Atkinson 800 36/40 tabular (24 on mobile); label 14/16
 * --ink-3; optional pen progress line. Grid them 4-up desktop, 2×2 mobile.
 * `value` may be a local-store island (e.g. <LocalCount kind="words" />).
 */
export interface StatTileProps {
  value: ReactNode;
  label: ReactNode;
  /** 0–1 for an optional pen progress line under the value. */
  progress?: number;
  className?: string;
}

export function StatTile({ value, label, progress, className }: StatTileProps) {
  return (
    <div className={cx('grid content-start gap-2 rounded-paper border border-line-soft p-5', className)}>
      <p className="grid gap-1">
        <span className="num text-[24px] leading-[28px] font-extrabold text-ink md:text-[36px] md:leading-10">{value}</span>
        <span className="text-caption leading-4 font-semibold text-ink-3">{label}</span>
      </p>
      {progress !== undefined ? <ProgressLine value={progress} width="100%" height={10} /> : null}
    </div>
  );
}

/** The 4-up / 2×2 grid for stat tiles (never one column). */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('grid grid-cols-2 gap-4 lg:grid-cols-4', className)}>{children}</div>;
}
