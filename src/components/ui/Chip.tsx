import type { ComponentProps, ReactNode } from 'react';

import { MiniTick } from '@/components/pen/marks';

import { cx } from './cx';

/**
 * Chips, tags and count pills (DESIGN §11.5, §11.21).
 */

export interface ChipProps extends ComponentProps<'button'> {
  /** Filter chip state: filled when pressed, exposed as aria-pressed. */
  pressed?: boolean;
  icon?: ReactNode;
}

/** Filter chip: 40px pill, 1.5px --line-control border, Atkinson 600 15. */
export function Chip({ pressed = false, icon, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cx(
        "relative inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-pill border-[1.5px] px-4 text-small leading-none font-semibold whitespace-nowrap",
        "before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
        'transition-[background-color,border-color,color] duration-160 ease-out active:translate-y-px',
        pressed ? 'border-ink bg-ink text-paper hover:bg-ink-2' : 'border-line-control text-ink hover:border-ink hover:bg-sheet',
        'disabled:cursor-not-allowed disabled:border-dashed disabled:text-ink-3',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export interface VocabChipProps {
  word: string;
  /** The word appears in the draft: --ink border, weight 800 and a pen tick. */
  used: boolean;
  /** Draw the tick in (once, the moment it becomes used). */
  animate?: boolean;
  className?: string;
}

/** Vocabulary chip in the writing editor (non-interactive status). */
export function VocabChip({ word, used, animate = false, className }: VocabChipProps) {
  return (
    <span
      className={cx(
        'inline-flex min-h-9 items-center gap-2 rounded-pill border-[1.5px] px-3 text-small leading-none',
        used ? 'border-ink font-extrabold text-ink' : 'border-line-control font-semibold text-ink-2',
        className,
      )}
    >
      {used ? <MiniTick animate={animate} /> : null}
      {word}
      <span className="sr-only">{used ? ', used' : ', not used yet'}</span>
    </span>
  );
}

/** Tag ("Practice story"): 28px pill, 1.5px --ink border, 14px 700. Not interactive. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex min-h-7 items-center rounded-pill border-[1.5px] border-ink px-3 text-caption leading-none font-bold text-ink', className)}>
      {children}
    </span>
  );
}

export interface CountPillProps {
  value: number | null;
  /** 28 (default), 24 (app nav), 18 (tab-bar badge). */
  size?: 28 | 24 | 18;
  /** Replay the 160ms tick when the value changes. */
  tick?: boolean;
  className?: string;
}

/**
 * Count pill: --ink fill, Atkinson 800 tabular. `null` renders the same box
 * empty (local-store islands before hydration), so nothing shifts.
 */
export function CountPill({ value, size = 28, tick = false, className }: CountPillProps) {
  const dims =
    size === 18
      ? 'h-[18px] min-w-[18px] px-[5px] text-micro'
      : size === 24
        ? 'h-6 min-w-6 px-2 text-caption'
        : 'h-7 min-w-7 px-2 text-small';
  return (
    <span
      className={cx('inline-grid place-items-center overflow-hidden rounded-pill bg-ink leading-none font-extrabold text-paper num', dims, className)}
      aria-hidden={value === null || undefined}
    >
      {/* suppressHydrationWarning: a pre-paint script may already have written the stored count here (see WordsNavLink). */}
      <span key={tick && value !== null ? value : undefined} className={tick && value !== null ? 'count-tick' : undefined} suppressHydrationWarning>
        {value ?? ' '}
      </span>
    </span>
  );
}
