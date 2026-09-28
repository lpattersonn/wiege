'use client';

import { useId, type ReactNode } from 'react';

import { cx } from './cx';

/**
 * Segmented control (DESIGN §11.4) for 2–4 options: grade band, sort, theme,
 * font, size, spacing. Built as <fieldset> + <legend> + radio inputs, so the
 * arrow keys move between options natively and the group has a name.
 * Pill container, 1.5px --line-control border, 3px inner padding; options
 * 40px tall (44px hit area); the selected option is filled.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  /** Group name read by screen readers ("Reading level"). */
  legend: string;
  /** Show the legend as a 15px 700 label above (settings rows). Hidden by default. */
  showLegend?: boolean;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  /** Radio group name (auto by default). */
  name?: string;
  /** Stretch to the container width with equal options. */
  block?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Segmented<T extends string>({ legend, showLegend = false, options, value, onChange, name, block = false, disabled, className }: SegmentedProps<T>) {
  const autoName = useId();
  const group = name ?? autoName;
  const legendId = `${autoName}-legend`;
  return (
    // role="radiogroup" (allowed on <fieldset>) so screen readers announce "radio group" and the
    // option count; the legend still names it, referenced explicitly for every browser.
    <fieldset
      role="radiogroup"
      aria-labelledby={legendId}
      className={cx('m-0 min-w-0 border-0 p-0', block ? 'grid gap-2' : 'inline-grid gap-2', className)}
      disabled={disabled}
    >
      <legend id={legendId} className={cx(showLegend ? 'mb-2 p-0 text-small font-bold text-ink' : 'sr-only')}>
        {legend}
      </legend>
      <div
        className={cx(
          'gap-0.5 rounded-pill border-[1.5px] border-line-control p-[3px]',
          block ? 'grid auto-cols-fr grid-flow-col' : 'inline-flex w-fit max-w-full',
        )}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cx(
                "relative inline-flex min-h-10 cursor-pointer items-center justify-center rounded-pill px-4 text-small leading-none font-bold whitespace-nowrap select-none",
                "before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
                'transition-[background-color,color] duration-160 ease-out',
                'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink',
                checked ? 'bg-ink text-paper' : 'text-ink hover:bg-sheet',
                'has-disabled:cursor-not-allowed has-disabled:text-ink-3',
              )}
            >
              <input
                type="radio"
                name={group}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                aria-label={option.ariaLabel}
                onChange={() => onChange(option.value)}
                className="absolute size-px appearance-none opacity-0"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
