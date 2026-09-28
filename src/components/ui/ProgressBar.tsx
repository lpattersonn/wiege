import { useId, type ReactNode } from 'react';

import { ProgressLine } from '@/components/pen/marks';

import { cx } from './cx';

/**
 * Progress bar (DESIGN §11.11): a pen line on a dotted track, always with
 * its text label beside it ("Question 2 of 5", "140 XP to Wordsmith").
 * role="progressbar" with aria-valuenow/min/max and aria-valuetext = label.
 */
export interface ProgressBarProps {
  value: number;
  max: number;
  min?: number;
  /** Visible label; also the aria-valuetext. */
  label: ReactNode;
  /** Plain-text version of `label` when it contains markup. */
  valueText?: string;
  /** Track width in px (240 default; 120 in story rows). */
  width?: number | string;
  height?: number;
  /** Accessible name ("Quiz progress"). Defaults to the visible label. */
  name?: string;
  /** Label after the line instead of before. */
  labelAfter?: boolean;
  animate?: boolean;
  seed?: number;
  className?: string;
}

export function ProgressBar({ value, max, min = 0, label, valueText, name, width = 240, height = 12, labelAfter = false, animate, seed, className }: ProgressBarProps) {
  const labelId = useId();
  const span = Math.max(1, max - min);
  const ratio = Math.max(0, Math.min(1, (value - min) / span));
  const text = valueText ?? (typeof label === 'string' ? label : undefined);
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={text}
      aria-label={name}
      aria-labelledby={name ? undefined : labelId}
      className={cx('flex items-center gap-4 text-small font-bold text-ink-2', labelAfter && 'flex-row-reverse justify-end', className)}
    >
      <span id={labelId} className="num">
        {label}
      </span>
      <span className="block min-w-0 flex-1" style={{ maxWidth: width }}>
        <ProgressLine value={ratio} width="100%" height={height} animate={animate} seed={seed} />
      </span>
    </div>
  );
}
