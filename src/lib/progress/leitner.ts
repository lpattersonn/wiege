import { addDays, dayKey, startOfDay } from '@/lib/time';

/**
 * Leitner flashcards (SPEC §7): boxes 1–5 with intervals 0, 1, 3, 7, 16 days.
 * Again → box 1, due now · Hard → same box, half its interval · Good → box + 1 ·
 * Easy → box + 2 (max 5). Intervals of a day or more fall due at the start of
 * the local day, so a card reviewed in the evening is ready the next morning.
 */

export const LEITNER_INTERVAL_DAYS = [0, 1, 3, 7, 16] as const;
export const MIN_BOX = 1;
export const MAX_BOX = 5;

export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];

export interface CardSchedule {
  box: number;
  dueAt: number;
  reviews: number;
  lapses: number;
}

export function clampBox(box: number): number {
  if (!Number.isFinite(box)) return MIN_BOX;
  return Math.min(MAX_BOX, Math.max(MIN_BOX, Math.round(box)));
}

export function intervalDays(box: number): number {
  return LEITNER_INTERVAL_DAYS[clampBox(box) - 1];
}

/** Due time `days` after `now`: now itself for 0, else local midnight that many days later. */
export function dueAfter(days: number, now: number, timeZone: string): number {
  if (days <= 0) return now;
  return startOfDay(addDays(dayKey(now, timeZone), Math.ceil(days)), timeZone);
}

export function scheduleReview(card: CardSchedule, grade: ReviewGrade, now: number, timeZone: string): CardSchedule {
  const box = clampBox(card.box);
  const reviews = card.reviews + 1;
  switch (grade) {
    case 'again':
      return { box: MIN_BOX, dueAt: now, reviews, lapses: card.lapses + 1 };
    case 'hard':
      // Half of the current box's interval, rounded up to whole days (box 1 stays due now).
      return { box, dueAt: dueAfter(intervalDays(box) / 2, now, timeZone), reviews, lapses: card.lapses };
    case 'good': {
      const next = clampBox(box + 1);
      return { box: next, dueAt: dueAfter(intervalDays(next), now, timeZone), reviews, lapses: card.lapses };
    }
    case 'easy': {
      const next = clampBox(box + 2);
      return { box: next, dueAt: dueAfter(intervalDays(next), now, timeZone), reviews, lapses: card.lapses };
    }
  }
}

/** A freshly saved word: box 1, due immediately. */
export function newCardSchedule(now: number): CardSchedule {
  return { box: MIN_BOX, dueAt: now, reviews: 0, lapses: 0 };
}

export function isDue(card: Pick<CardSchedule, 'dueAt'>, now: number): boolean {
  return card.dueAt <= now;
}

/** Due cards, most overdue first (lower boxes first on ties), at most `limit`. */
export function dueCards<T extends Pick<CardSchedule, 'dueAt' | 'box'>>(cards: Iterable<T>, now: number, limit = 20): T[] {
  return [...cards]
    .filter((card) => isDue(card, now))
    .sort((a, b) => a.dueAt - b.dueAt || a.box - b.box)
    .slice(0, Math.max(0, limit));
}
