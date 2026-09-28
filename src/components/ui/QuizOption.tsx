import type { ComponentProps, ReactNode } from 'react';

import { Cross, Ring, Tick } from '@/components/pen/PenMark';

import { cx } from './cx';

/**
 * Quiz choice (DESIGN §11.10). A bordered 12px-radius card button:
 * `36px letter circle | text | trailing tick`. States never use colour:
 *
 * - idle / hover (--ink border + --sheet) / focus ring
 * - selected: 2px --ink border, inverted letter (a pick awaiting "Check")
 * - correct: 2px --ink border, pen ring on the letter, pen tick, weight 600,
 *   label "Right answer"
 * - first-try: wrong on the first try — dashed border, hatch strip, pen cross
 *   on the letter, struck-through --ink-2 text, label "Your first try",
 *   screen-reader suffix "Not correct."
 * - incorrect: a later wrong pick — same treatment, label "Not this one"
 *
 * After solving, pass `disabled` to the others: they keep full contrast.
 *
 * Semantics: role="radio" with aria-checked (the student's current pick).
 * Put the options in <QuizChoices> (a radiogroup with one tab stop; arrow
 * keys move focus, Enter/Space picks, because a pick is an answer). `disabled`
 * is exposed as aria-disabled rather than the HTML attribute, so the option a
 * student just picked keeps focus instead of dropping it to <body>, and
 * screen-reader users can still read solved options.
 */
export type QuizOptionState = 'idle' | 'selected' | 'correct' | 'incorrect' | 'first-try';

export interface QuizOptionProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** "A"–"D". */
  letter: string;
  children: ReactNode;
  state?: QuizOptionState;
  /** Override the state label ("Right answer", "Your first try", "Not this one"). */
  label?: string;
  /** Draw the pen marks in (the student just picked this). */
  animate?: boolean;
  /** Show the handwritten "first try" aside beside a first-try pick (max one per viewport). */
  aside?: boolean;
  /** Seed scope for the marks (question id). */
  scope?: string;
  /** The student's current pick (aria-checked). Defaults to `selected` or `correct`. */
  checked?: boolean;
}

const LABELS: Partial<Record<QuizOptionState, string>> = {
  correct: 'Right answer',
  'first-try': 'Your first try',
  incorrect: 'Not this one',
};

export function QuizOption({
  letter,
  children,
  state = 'idle',
  label,
  animate = false,
  aside = false,
  scope = '',
  checked,
  disabled = false,
  onClick,
  className,
  type = 'button',
  ...rest
}: QuizOptionProps) {
  const wrong = state === 'first-try' || state === 'incorrect';
  const strong = state === 'correct' || state === 'selected';
  const stateLabel = label ?? LABELS[state];
  return (
    <button
      type={type}
      role="radio"
      aria-checked={checked ?? strong}
      aria-disabled={disabled || undefined}
      data-state={state}
      // Only wrap a real handler: a server page renders static options with no function props.
      onClick={
        onClick
          ? (event) => {
              if (disabled) {
                event.preventDefault();
                return;
              }
              onClick(event);
            }
          : undefined
      }
      className={cx(
        'relative grid min-h-[60px] w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-4 rounded-control bg-paper text-left type-choice text-ink',
        'transition-[border-color,background-color] duration-160 ease-out',
        disabled ? 'cursor-default' : 'cursor-pointer',
        strong ? 'border-2 border-ink px-[15.5px] py-[11.5px]' : 'border-[1.5px] px-4 py-3',
        wrong ? 'hatch-strip overflow-hidden border-dashed border-line-control' : !strong && 'border-line-control',
        state === 'idle' && !disabled && 'hover:border-ink hover:bg-sheet',
        className,
      )}
      {...rest}
    >
      <span
        className={cx(
          'relative grid size-9 place-items-center rounded-pill border-[1.5px] font-ui text-nav leading-none font-extrabold',
          state === 'selected' ? 'border-ink bg-ink text-paper' : wrong || state === 'correct' ? 'border-transparent' : 'border-line-control',
        )}
        aria-hidden="true"
      >
        {letter}
        {state === 'correct' ? <Ring word={letter} scope={scope} animate={animate} /> : null}
        {wrong ? <Cross word={letter} scope={scope} animate={animate} duration={260} /> : null}
      </span>
      <span className="min-w-0">
        {stateLabel ? <span className="mb-1 block font-ui text-caption leading-[1.2] font-bold text-ink">{stateLabel}</span> : null}
        <span className={cx(state === 'correct' && 'font-semibold', wrong && 'text-ink-2 line-through decoration-[1.5px]')}>{children}</span>
        {wrong ? <span className="sr-only"> Not correct.</span> : null}
        {state === 'correct' ? <span className="sr-only"> Correct.</span> : null}
      </span>
      <span className="flex items-center" aria-hidden="true">
        {state === 'correct' ? (
          <span className="relative block h-[26px] w-[30px]">
            <Tick animate={animate} delay={animate ? 200 : undefined} />
          </span>
        ) : null}
    {state === 'first-try' && aside ? <span className="ml-2 type-hand whitespace-nowrap">first try</span> : null}
      </span>
    </button>
  );
}
