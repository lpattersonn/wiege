import type { CSSProperties, ReactNode } from 'react';

import { MarkedWord } from '@/components/pen/MasteryMark';
import { bodoniEm, LOOP_INSETS } from '@/components/pen/metrics';

import { cx } from './cx';

/**
 * Flashcard shell (DESIGN §11.19): an index card — 1.5px --ink border, 16px
 * radius, 24px padding, min height 300 (440 on mobile practice) — with a
 * second card edge peeking 8px below. The whole card is a button that flips
 * (rotateY 360ms; instant under reduced motion). The practice runner owns
 * the keyboard (Space flips, 1–4 grade, Esc ends) and the grading logic.
 *
 * Not a client component on its own: it has no state, so a server page can
 * render a static card, and a client runner that passes `onFlip` bundles it.
 * The word is set at 56/52px but fitted to the card width (plus room for the
 * loop's side insets), so "momentum" never overflows a 360px screen.
 */
export interface FlashcardProps {
  word: string;
  /** Leitner box 1–5: the pen mark on the word. */
  mastery: number;
  definition: string;
  example?: string;
  /** Story the word came from: "From “{title}”". */
  storyTitle?: string;
  flipped: boolean;
  onFlip?: () => void;
  /** Redraw the mastery mark (it just went up). */
  animateMark?: boolean;
  /** 'practice' = 440px tall on mobile. */
  size?: 'default' | 'practice';
  /** Hint under the word on the front. */
  hint?: ReactNode;
  className?: string;
}

const face = 'flip-face grid min-h-[inherit] content-between gap-6 rounded-card border-[1.5px] border-ink bg-paper p-6 text-left [container-type:inline-size]';

/** `--flash-fit` for a word: the card's content width divided by the word's width in em (Bodoni 900, −0.02em) plus the loop's side insets. */
function fitStyle(word: string): CSSProperties {
  const em = bodoniEm(word, { weight: 900, tracking: -0.02 }) + 2 * LOOP_INSETS.list.lx;
  return { '--flash-fit': `calc(100cqw / ${em.toFixed(3)})` } as CSSProperties;
}

export function Flashcard({
  word,
  mastery,
  definition,
  example,
  storyTitle,
  flipped,
  onFlip,
  animateMark = false,
  size = 'default',
  hint = 'Tap the card or press Space to flip',
  className,
}: FlashcardProps) {
  return (
    <div
      className={cx(
        'relative min-w-0 pb-2',
        "after:pointer-events-none after:absolute after:inset-x-4 after:bottom-0 after:h-2 after:rounded-b-card after:border-[1.5px] after:border-t-0 after:border-ink after:content-['']",
        className,
      )}
    >
      <button
        type="button"
        onClick={onFlip}
        data-flipped={flipped ? 'true' : 'false'}
        className={cx('flip relative z-1 w-full cursor-pointer rounded-card', size === 'practice' ? 'min-h-[440px] md:min-h-[300px]' : 'min-h-[300px]')}
      >
        <span className="flip-inner min-h-[inherit]">
          <span className={cx(face, 'justify-items-center text-center md:justify-items-start md:text-left')} aria-hidden={flipped || undefined} inert={flipped || undefined}>
            <span className="justify-self-start text-caption font-bold text-ink-3">Front of the card</span>
            <span className="type-flash-word text-ink" style={fitStyle(word)}>
              <MarkedWord word={word} level={mastery} font="display-900" animate={animateMark} />
            </span>
            <span className="text-caption text-ink-3">{hint}</span>
          </span>
          <span className={cx(face, 'flip-back')} aria-hidden={!flipped || undefined} inert={!flipped || undefined}>
            <span className="grid gap-3">
              <span className="text-caption font-bold text-ink-3">Back of the card</span>
              <span className="type-flash-word mt-1 pb-[.3em] text-ink" style={fitStyle(word)}>
                <MarkedWord word={word} level={mastery} font="display-900" />
              </span>
              <span className="text-[19px] leading-[28px] text-ink">{definition}</span>
              {example ? <span className="font-read text-choice leading-[1.55] text-ink-2 italic">{example}</span> : null}
            </span>
            {storyTitle ? <span className="text-caption text-ink-3">From “{storyTitle}”</span> : null}
          </span>
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        {flipped ? `${word}: ${definition}` : ''}
      </span>
    </div>
  );
}

export type Grade = 'again' | 'hard' | 'good' | 'easy';

const GRADES: Array<{ grade: Grade; label: string; key: string }> = [
  { grade: 'again', label: 'Again', key: '1' },
  { grade: 'hard', label: 'Hard', key: '2' },
  { grade: 'good', label: 'Good', key: '3' },
  { grade: 'easy', label: 'Easy', key: '4' },
];

/** The four grade buttons after the flip: 64px, 12px radius; Good has a 2px border. */
export function FlashcardGrades({ onGrade, disabled, className }: { onGrade?: (grade: Grade) => void; disabled?: boolean; className?: string }) {
  return (
    <div role="group" aria-label="How well did you know it?" className={cx('grid grid-cols-4 gap-2', className)}>
      {GRADES.map(({ grade, label, key }) => (
        <button
          key={grade}
          type="button"
          disabled={disabled}
          onClick={onGrade ? () => onGrade(grade) : undefined}
          aria-keyshortcuts={key}
          className={cx(
            'grid min-h-16 cursor-pointer content-center justify-items-center gap-0.5 rounded-control bg-paper text-nav font-extrabold text-ink',
            'transition-[border-color,background-color] duration-160 hover:border-ink hover:bg-sheet active:translate-y-px',
            grade === 'good' ? 'border-2 border-ink' : 'border-[1.5px] border-line-control',
            'disabled:cursor-not-allowed disabled:border-dashed',
          )}
        >
          {label}
          <small className="text-caption font-semibold text-ink-3">Press {key}</small>
        </button>
      ))}
    </div>
  );
}
