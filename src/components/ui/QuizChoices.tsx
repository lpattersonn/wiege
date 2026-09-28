'use client';

import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

import { cx } from './cx';

/**
 * The radiogroup around a question's <QuizOption>s (DESIGN §11.10, §13.5).
 *
 * - One tab stop (roving tabindex): the focused option, else the student's
 *   pick (aria-checked), else the first option still open, else the first.
 * - Arrow keys, Home and End move focus. Enter or Space picks. Arrows do not
 *   pick on their own (APG "manual activation"), because a pick is an answer
 *   and a wrong one would be recorded just by moving through the list.
 * - Name it with `labelledBy` (the question's id) or `label`.
 *
 * The options stay server-rendered children; this island only manages focus.
 */
export function QuizChoices({ labelledBy, label, className, children }: { labelledBy?: string; label?: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const radios = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []);

  const setTabStop = (target?: HTMLElement) => {
    const all = radios();
    const stop =
      target ??
      all.find((r) => r === document.activeElement) ??
      all.find((r) => r.getAttribute('aria-checked') === 'true') ??
      all.find((r) => r.getAttribute('aria-disabled') !== 'true') ??
      all[0];
    for (const r of all) r.tabIndex = r === stop ? 0 : -1;
  };

  // After every render: options change state (picked, solved) as the student answers.
  useLayoutEffect(() => setTabStop());

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step && event.key !== 'Home' && event.key !== 'End') return;
    const all = radios();
    const index = all.indexOf(document.activeElement as HTMLElement);
    if (index < 0 || !all.length) return;
    event.preventDefault();
    const next = event.key === 'Home' ? all[0] : event.key === 'End' ? all[all.length - 1] : all[(index + step + all.length) % all.length];
    setTabStop(next);
    next.focus();
  }

  return (
    <div ref={ref} role="radiogroup" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label} onKeyDown={onKeyDown} className={cx('grid gap-3', className)}>
      {children}
    </div>
  );
}
