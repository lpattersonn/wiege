import type { CategorySlug } from '@/lib/categories';
import { addDays, startOfWeek, type DayKey } from '@/lib/time';

import { BADGES, type BadgeDefinition, type BadgeId, type BadgeProgress } from './badges';
import { isDue } from './leitner';
import { levelProgress, type LevelProgress } from './levels';
import { currentStreak, readingDays } from './streak';
import type { ActivityEntry } from './types';

/**
 * Derived numbers for /me and the Today islands. Accepts any structurally
 * compatible object, so the local store's `LocalState` can be passed directly.
 */
export interface StatsSource {
  xp: number;
  longestStreak: number;
  reads: Readonly<Record<string, { category: CategorySlug; completedAt?: number; quiz?: { score: number; total: number } }>>;
  words: Readonly<Record<string, { dueAt: number; reviews: number }>>;
  journal: Readonly<Record<string, { wordCount: number }>>;
  activity: readonly ActivityEntry[];
  badges: Readonly<Partial<Record<BadgeId, { awardedAt: number }>>>;
}

export interface ProgressTotals {
  xp: number;
  level: LevelProgress;
  storiesRead: number;
  wordsCollected: number;
  wordsDue: number;
  journalEntries: number;
  currentStreak: number;
  bestStreak: number;
  stampsUnlocked: number;
}

const values = <T>(record: Readonly<Record<string, T>>): T[] => Object.values(record);

function completedReads(source: Pick<StatsSource, 'reads'>) {
  return values(source.reads).filter((read) => read.completedAt !== undefined);
}

function writtenEntries(source: Pick<StatsSource, 'journal'>): number {
  return values(source.journal).filter((entry) => entry.wordCount > 0).length;
}

export function progressTotals(source: StatsSource, today: DayKey, now: number): ProgressTotals {
  const current = currentStreak(readingDays(source.activity), today);
  return {
    xp: source.xp,
    level: levelProgress(source.xp),
    storiesRead: completedReads(source).length,
    wordsCollected: Object.keys(source.words).length,
    wordsDue: values(source.words).filter((word) => isDue(word, now)).length,
    journalEntries: writtenEntries(source),
    currentStreak: current,
    bestStreak: Math.max(source.longestStreak, current),
    stampsUnlocked: Object.keys(source.badges).length,
  };
}

/** Inputs for the stamp rules (see badges.ts). */
export function badgeProgress(source: StatsSource, today: DayKey): BadgeProgress {
  const completed = completedReads(source);
  const current = currentStreak(readingDays(source.activity), today);
  return {
    storiesCompleted: completed.length,
    categoriesCompleted: new Set(completed.map((read) => read.category)).size,
    wordsSaved: Object.keys(source.words).length,
    journalEntries: writtenEntries(source),
    hasPerfectQuiz: values(source.reads).some((read) => read.quiz !== undefined && read.quiz.total > 0 && read.quiz.score >= read.quiz.total),
    bestStreak: Math.max(source.longestStreak, current),
    reviews: values(source.words).reduce((sum, word) => sum + word.reviews, 0),
  };
}

export interface CalendarDay {
  day: DayKey;
  xp: number;
  /** Number of activities logged that day. */
  activities: number;
  /** True when the day counts towards the streak. */
  reading: boolean;
  /** 0 (nothing) to 4 (a lot), for the ink density of the cell. */
  intensity: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
}

function intensityFor(activities: number, xp: number): CalendarDay['intensity'] {
  if (activities === 0) return 0;
  if (xp < 10) return 1;
  if (xp < 25) return 2;
  if (xp < 50) return 3;
  return 4;
}

/**
 * The reading calendar: `weeks` columns (oldest first) of 7 days, Monday to
 * Sunday; the last column is the current week, so its later days are future.
 */
export function readingCalendar(activity: readonly ActivityEntry[], today: DayKey, weeks = 12): CalendarDay[][] {
  const byDay = new Map<DayKey, { xp: number; activities: number }>();
  for (const entry of activity) {
    const bucket = byDay.get(entry.day) ?? { xp: 0, activities: 0 };
    bucket.xp += entry.xp;
    bucket.activities += 1;
    byDay.set(entry.day, bucket);
  }
  const reading = readingDays(activity);
  const firstMonday = addDays(startOfWeek(today), -7 * (weeks - 1));
  const columns: CalendarDay[][] = [];
  for (let week = 0; week < weeks; week++) {
    const column: CalendarDay[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = addDays(firstMonday, week * 7 + weekday);
      const bucket = byDay.get(day) ?? { xp: 0, activities: 0 };
      column.push({
        day,
        xp: bucket.xp,
        activities: bucket.activities,
        reading: reading.has(day),
        intensity: intensityFor(bucket.activities, bucket.xp),
        isToday: day === today,
        isFuture: day > today,
      });
    }
    columns.push(column);
  }
  return columns;
}

export interface StampState extends BadgeDefinition {
  unlocked: boolean;
  awardedAt: number | null;
}

/** Every stamp in display order, locked ones included (shown as outlines with their hint). */
export function stampWall(awarded: Readonly<Partial<Record<BadgeId, { awardedAt: number }>>>): StampState[] {
  return BADGES.map((badge) => {
    const award = Object.prototype.hasOwnProperty.call(awarded, badge.id) ? awarded[badge.id] : undefined;
    return { ...badge, unlocked: award !== undefined, awardedAt: award?.awardedAt ?? null };
  });
}
