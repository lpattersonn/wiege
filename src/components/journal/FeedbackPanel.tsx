import { MiniTick, NoteMarkIcon } from '@/components/pen/marks';
import { BOX_TICK, boxPath } from '@/components/pen/pen';
import { cx } from '@/components/ui/cx';
import type { WritingFeedback } from '@/lib/literacy/types';

import { noteParts, RUBRIC_LABELS, rubricScore, type DraftMark, type FeedbackNote } from './feedback-marks';

/**
 * Notes on the draft (DESIGN §11.12): always the Working notes before at most
 * two Try next notes, each with the icon of the mark it made on the draft, a
 * Bodoni kind label and a sentence that quotes the student in Literata italic.
 * Then the next step and the 1–4 scores. The checklist shows the real steps
 * of an AI request, each ticked as it finishes.
 */

export const FEEDBACK_STEPS = ['Counting sentences', 'Checking your vocabulary words', 'Reading for ideas', 'Writing notes'] as const;

export function FeedbackSteps({ done, className }: { done: number; className?: string }) {
  return (
    <div className={cx('grid gap-3 rounded-paper border border-line-soft p-4', className)}>
      <p className="text-small font-bold text-ink">Getting AI notes</p>
      <ol className="grid gap-2" aria-live="polite">
        {FEEDBACK_STEPS.map((label, i) => {
          const complete = i < done;
          return (
            <li key={label} className={cx('flex items-center gap-3 text-small', complete ? 'font-semibold text-ink' : 'text-ink-2')}>
              <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center">
                {complete ? <MiniTick animate /> : <span className={cx('block size-4 rounded-pill border-[1.5px] border-dashed border-ink-3', i === done && 'border-ink-2')} />}
              </span>
              <span>
                {label}
                <span className="sr-only">{complete ? ', done' : i === done ? ', working' : ', waiting'}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NoteText({ text }: { text: string }) {
  return (
    <>
      {noteParts(text).map((part, i) =>
        part.quoted ? (
          <q key={i} className="font-read text-ink italic">
            {part.text}
          </q>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function RubricBoxes({ score, seed }: { score: number; seed: number }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="pm-static relative size-4">
          <svg viewBox="0 0 22 22" className="absolute inset-0 size-4">
            <path d={boxPath(seed + i)} style={{ strokeWidth: 1.4 }} />
          </svg>
          {i < score ? (
            <svg viewBox="0 0 22 22" className="absolute inset-0 size-4">
              <path d={BOX_TICK} style={{ strokeWidth: 2 }} />
            </svg>
          ) : null}
        </span>
      ))}
    </span>
  );
}

export interface FeedbackPanelProps {
  feedback: WritingFeedback;
  notes: readonly FeedbackNote[];
  marks: readonly DraftMark[];
  /** Prefix for note ids (the draft's marks point at `${idPrefix}-${note.key}`). */
  idPrefix: string;
  headingId: string;
  headingLevel: 'h2' | 'h3';
  /** Notes are for an earlier version of the draft. */
  stale: boolean;
  /** Notes hidden by the student ("Hide notes"). */
  hidden: boolean;
  /** AI request in progress: number of steps done, else null. */
  stepsDone: number | null;
  /** Why the AI notes were not used (from the API), or null. */
  message: string | null;
  className?: string;
}

export function FeedbackPanel({ feedback, notes, marks, idPrefix, headingId, headingLevel: H, stale, hidden, stepsDone, message, className }: FeedbackPanelProps) {
  const markFor = (key: string) => marks.find((m) => m.noteKey === key)?.kind;
  const Sub = H === 'h2' ? 'h3' : 'h4';
  return (
    <section aria-labelledby={headingId} className={cx('grid content-start gap-6', className)}>
      <H id={headingId} className="type-h4">
        Notes on your draft
      </H>
      {stepsDone !== null ? <FeedbackSteps done={stepsDone} /> : null}
      {stale ? <p className="text-small text-ink-2">These notes are for an earlier version of your draft. Ask again to update them.</p> : null}
      {hidden ? (
        <p className="text-small text-ink-2">Notes are hidden. Your writing is just as you left it.</p>
      ) : (
        <>
          <ul className="grid gap-5">
            {notes.map((note) => {
              const kind = markFor(note.key) ?? (note.kind === 'glow' ? 'double' : 'caret');
              return (
                <li key={note.key} id={`${idPrefix}-${note.key}`} className="grid grid-cols-[28px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
                  <NoteMarkIcon kind={kind} className="self-center" />
                  <p className="font-title text-[22px] leading-[1.1] font-bold text-ink">{note.kind === 'glow' ? 'Working' : 'Try next'}</p>
                  <p className="col-start-2 text-nav leading-[1.55] text-ink-2">
                    <NoteText text={note.text} />
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="grid gap-1 border-t border-line-soft pt-4">
            <Sub className="text-small font-bold text-ink">Your next step</Sub>
            <p className="text-nav leading-[1.55] text-ink-2">
              <NoteText text={feedback.nextStep} />
            </p>
          </div>
        </>
      )}
      <div className="grid gap-2 border-t border-line-soft pt-4">
        <Sub className="text-small font-bold text-ink">Scores, out of 4</Sub>
        <dl className="grid gap-1.5">
          {RUBRIC_LABELS.map(({ key, label }, i) => {
            const score = rubricScore(feedback.rubric[key]);
            return (
              <div key={key} className="flex items-center justify-between gap-3 text-small">
                <dt className="text-ink-2">{label}</dt>
                <dd className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
                  <RubricBoxes score={score} seed={60 + i * 7} />
                  <span className="num min-w-[4ch] text-right font-bold text-ink">
                    {score} <span className="font-normal text-ink-2">of 4</span>
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      <p className="text-caption text-ink-3">
        {feedback.generator === 'claude' ? 'Notes written with AI. They never change your writing.' : 'Instant notes, written on this device. They never change your writing.'}
      </p>
      {/* Always mounted so the reason is announced when it arrives. */}
      <p role="status" className={message ? 'text-small text-ink-2' : 'sr-only'}>
        {message ?? ''}
      </p>
    </section>
  );
}
