import { describe, expect, it } from 'vitest';

import {
  feedbackHeadline,
  firstAnswers,
  firstTryScore,
  isSolved,
  nextQuestion,
  optionDisabled,
  optionState,
  pick,
  scoreLine,
  startQuiz,
} from './quiz-logic';

describe('quiz flow', () => {
  it('records picks until the right answer, then ignores more picks', () => {
    let p = startQuiz(2);
    p = pick(p, 1, 3); // wrong
    p = pick(p, 1, 3); // same wrong again: ignored
    p = pick(p, 1, 1); // right
    p = pick(p, 1, 0); // after solving: ignored
    expect(p.picks[0]).toEqual([3, 1]);
    expect(isSolved(p.picks[0], 1)).toBe(true);
    p = nextQuestion(p);
    expect(p.index).toBe(1);
    p = pick(p, 2, 2);
    expect(p.picks).toEqual([[3, 1], [2]]);
    expect(firstAnswers(p)).toEqual([3, 2]);
    expect(firstTryScore(firstAnswers(p), [1, 2])).toBe(1);
  });

  it('marks unanswered questions with -1', () => {
    expect(firstAnswers(startQuiz(3))).toEqual([-1, -1, -1]);
  });
});

describe('option states (by shape, not colour)', () => {
  it('shows first try, later wrong picks and the right answer', () => {
    const picks = [2, 0, 1];
    expect(optionState(picks, 1, 2)).toBe('first-try');
    expect(optionState(picks, 1, 0)).toBe('incorrect');
    expect(optionState(picks, 1, 1)).toBe('correct');
    expect(optionState(picks, 1, 3)).toBe('idle');
  });

  it('disables tried answers, and everything else once solved', () => {
    expect(optionDisabled([2], 1, 2)).toBe(true);
    expect(optionDisabled([2], 1, 3)).toBe(false);
    expect(optionDisabled([2, 1], 1, 3)).toBe(true);
    expect(optionDisabled([2, 1], 1, 1)).toBe(false);
  });
});

describe('copy', () => {
  it('says how many tries it took', () => {
    expect(feedbackHeadline([], 1)).toBeNull();
    expect(feedbackHeadline([1], 1)).toBe('Got it.');
    expect(feedbackHeadline([0, 1], 1)).toBe('Got it on the second try.');
    expect(feedbackHeadline([0, 2, 3, 1], 1)).toBe('Got it on the fourth try.');
    expect(feedbackHeadline([0], 1)).toBe('Not quite. That’s your first try.');
    expect(feedbackHeadline([0, 2], 1)).toBe('Not this one either.');
    expect(scoreLine(4, 5)).toBe('4 of 5 on your first try.');
  });
});
