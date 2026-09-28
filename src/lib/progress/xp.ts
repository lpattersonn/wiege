import type { DayKey } from '@/lib/time';

import type { ActivityEntry, ActivityKind } from './types';

/** XP rules (SPEC §7). */
export const XP_RULES = {
  finishStory: 10,
  correctAnswer: 5,
  perfectQuizBonus: 5,
  saveWord: 2,
  review: 1,
  journalEntry: 15,
} as const;

/**
 * Daily XP ceilings per activity kind, in XP (not actions): saving words earns at
 * most 10 XP a day (5 words), flashcard reviews at most 20 XP a day.
 */
export const DAILY_XP_CAPS: Readonly<Partial<Record<ActivityKind, number>>> = {
  word: 10,
  review: 20,
};

/** Free writes have no prompt; this is their target length for the journal XP. */
export const FREE_WRITE_MIN_WORDS = 50;

/** Floor for any prompt's `minWords`, so tiny entries cannot farm journal XP. */
export const JOURNAL_XP_MIN_WORDS_FLOOR = 20;

/** +5 per correct answer and +5 more for a perfect score. */
export function quizXp(score: number, total: number): number {
  if (!Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || score < 0) return 0;
  const correct = Math.min(score, total);
  return correct * XP_RULES.correctAnswer + (correct === total ? XP_RULES.perfectQuizBonus : 0);
}

export function xpEarnedOn(activity: readonly ActivityEntry[], day: DayKey, kind: ActivityKind): number {
  let total = 0;
  for (const entry of activity) {
    if (entry.day === day && entry.kind === kind) total += entry.xp;
  }
  return total;
}

/** `base` XP reduced so the day's total for `kind` never exceeds its cap. */
export function cappedXp(activity: readonly ActivityEntry[], day: DayKey, kind: ActivityKind, base: number): number {
  const cap = DAILY_XP_CAPS[kind];
  if (cap === undefined) return Math.max(0, base);
  return Math.max(0, Math.min(base, cap - xpEarnedOn(activity, day, kind)));
}

/** Journal XP: +15 once per entry, when it first reaches its prompt's minimum length. */
export function journalXp(wordCount: number, minWords: number, alreadyAwarded: boolean): number {
  if (alreadyAwarded) return 0;
  const target = Math.max(JOURNAL_XP_MIN_WORDS_FLOOR, Math.floor(minWords));
  return wordCount >= target ? XP_RULES.journalEntry : 0;
}

export function totalActivityXp(activity: readonly ActivityEntry[]): number {
  return activity.reduce((sum, entry) => sum + entry.xp, 0);
}
