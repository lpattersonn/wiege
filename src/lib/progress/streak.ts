import { addDays, diffDays, type DayKey } from '@/lib/time';

import type { ActivityEntry, ActivityKind } from './types';

/** A reading day is any day with `read` or `journal` activity (SPEC §7). */
export const STREAK_ACTIVITY_KINDS: ReadonlySet<ActivityKind> = new Set<ActivityKind>(['read', 'journal']);

export function readingDays(activity: readonly ActivityEntry[]): Set<DayKey> {
  const days = new Set<DayKey>();
  for (const entry of activity) {
    if (STREAK_ACTIVITY_KINDS.has(entry.kind)) days.add(entry.day);
  }
  return days;
}

/**
 * Consecutive reading days ending today, or ending yesterday when today has no
 * reading yet (the streak is still alive until the day is over).
 */
export function currentStreak(days: ReadonlySet<DayKey>, today: DayKey): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(days: Iterable<DayKey>): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const day of sorted) {
    run = previous !== null && diffDays(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export interface StreakSummary {
  current: number;
  longest: number;
  readToday: boolean;
  lastReadingDay: DayKey | null;
}

/** `storedLongest` keeps records older than the (pruned) activity log. */
export function streakSummary(activity: readonly ActivityEntry[], today: DayKey, storedLongest = 0): StreakSummary {
  const days = readingDays(activity);
  const current = currentStreak(days, today);
  const sorted = [...days].sort();
  return {
    current,
    longest: Math.max(storedLongest, current, longestStreak(days)),
    readToday: days.has(today),
    lastReadingDay: sorted.length > 0 ? sorted[sorted.length - 1] : null,
  };
}
