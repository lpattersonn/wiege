import type { QuizOptionState } from '@/components/ui/QuizOption';

/**
 * "Check your understanding" (SPEC §8, DESIGN §11.10): one question at a
 * time; a pick is an answer; a wrong pick is a first try, not a fail, and the
 * student keeps going until they find the right answer. The score that counts
 * (and earns XP) is right-on-the-first-try. Pure and unit-tested.
 */

export interface QuizProgress {
  /** Question on screen (0-based). */
  index: number;
  /** Every pick per question, in order. */
  picks: number[][];
}

export function startQuiz(total: number): QuizProgress {
  return { index: 0, picks: Array.from({ length: total }, () => []) };
}

export function isSolved(picks: readonly number[], answerIndex: number): boolean {
  return picks.includes(answerIndex);
}

/** Records a pick. Picking after the question is solved, or picking the same wrong answer twice, changes nothing. */
export function pick(progress: QuizProgress, answerIndex: number, choice: number): QuizProgress {
  const current = progress.picks[progress.index] ?? [];
  if (isSolved(current, answerIndex) || current.includes(choice)) return progress;
  const picks = progress.picks.map((p, i) => (i === progress.index ? [...p, choice] : p));
  return { ...progress, picks };
}

export function nextQuestion(progress: QuizProgress): QuizProgress {
  return { ...progress, index: progress.index + 1 };
}

/** How an option looks, by shape (never by colour). */
export function optionState(picks: readonly number[], answerIndex: number, choice: number): QuizOptionState {
  if (choice === answerIndex && picks.includes(choice)) return 'correct';
  if (picks[0] === choice) return 'first-try';
  if (picks.includes(choice)) return 'incorrect';
  return 'idle';
}

/** Options that can't be picked: all of them once solved, and wrong answers already tried. */
export function optionDisabled(picks: readonly number[], answerIndex: number, choice: number): boolean {
  return isSolved(picks, answerIndex) ? choice !== answerIndex : picks.includes(choice);
}

/** The first pick per question (-1 when unanswered), as stored in the quiz result. */
export function firstAnswers(progress: QuizProgress): number[] {
  return progress.picks.map((p) => (p.length ? p[0] : -1));
}

/** Right on the first try. */
export function firstTryScore(answers: readonly number[], answerIndexes: readonly number[]): number {
  return answerIndexes.reduce((n, answer, i) => n + (answers[i] === answer ? 1 : 0), 0);
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];

/** The headline of the feedback note (DESIGN §10: "Got it." / "Got it on the second try."). */
export function feedbackHeadline(picks: readonly number[], answerIndex: number): string | null {
  if (!picks.length) return null;
  if (!isSolved(picks, answerIndex)) return picks.length === 1 ? 'Not quite. That’s your first try.' : 'Not this one either.';
  const tries = picks.indexOf(answerIndex) + 1;
  return tries === 1 ? 'Got it.' : `Got it on the ${ORDINALS[tries - 1] ?? `${tries}th`} try.`;
}

/** "4 of 5 on your first try." */
export function scoreLine(score: number, total: number): string {
  return `${score} of ${total} on your first try.`;
}
