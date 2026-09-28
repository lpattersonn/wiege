'use client';

import { useId, type ReactNode } from 'react';

import { cx } from './cx';

/**
 * Switch (settings: "Use AI to write notes on my writing"). A real
 * role="switch" button; the whole row is the target. On = filled track,
 * plus the word "On"/"Off" so the state never depends on position alone.
 */
export interface SwitchProps {
  label: ReactNode;
  /** One plain sentence under the label (the AI disclosure, for example). */
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ label, description, checked, onChange, disabled, className }: SwitchProps) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div className={cx('flex items-start justify-between gap-6', className)}>
      <div className="grid min-w-0 gap-1">
        <label htmlFor={id} className="cursor-pointer text-ui leading-snug font-bold text-ink">
          {label}
        </label>
        {description ? (
          <p id={descId} className="max-w-[56ch] text-small leading-normal text-ink-2">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="group inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-pill text-caption font-bold text-ink-2 disabled:cursor-not-allowed"
      >
        <span aria-hidden="true" className="w-7 text-right">
          {checked ? 'On' : 'Off'}
        </span>
        <span
          aria-hidden="true"
          className={cx(
            'relative inline-block h-8 w-[52px] rounded-pill border-[1.5px] transition-[background-color,border-color] duration-160 ease-out',
            checked ? 'border-ink bg-ink' : 'border-line-control bg-paper group-hover:border-ink',
            'group-disabled:border-dashed',
          )}
        >
          <span
            className={cx(
              'absolute top-[3.5px] left-[3.5px] size-[22px] rounded-pill transition-transform duration-200 ease-out',
              checked ? 'translate-x-5 bg-paper' : 'translate-x-0 bg-ink-2',
            )}
          />
        </span>
      </button>
    </div>
  );
}
