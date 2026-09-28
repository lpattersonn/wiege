'use client';

import { useCallback } from 'react';

import { dispatch, useHydrated, useLocal, usePersistent } from '@/lib/local/store';
import { getOwn, normalizeWordKey, type LocalState, type Prefs, type ReadRecord, type WordEntry } from '@/lib/local/schema';
import { isDue } from '@/lib/progress/leitner';
import { progressTotals, type ProgressTotals } from '@/lib/progress/stats';
import { streakSummary, type StreakSummary } from '@/lib/progress/streak';
import { dayKey } from '@/lib/time';

import { announceTheme, type ThemePref } from './theme';

/**
 * Typed read hooks over the on-device store (src/lib/local/store.ts). Every
 * hook returns `null` until hydrated (server render and the hydration pass):
 * render a same-size placeholder for null so nothing shifts.
 *
 * Selectors are module-level (stable), as `useLocal` requires.
 */

export { useHydrated, usePersistent };

/** Generic escape hatch: `useLocalState((s) => s.xp)`. Keep the selector stable (module-level or useCallback). */
export const useLocalState = useLocal;

const selectWordCount = (s: LocalState) => Object.keys(s.words).length;
const selectDueCount = (s: LocalState) => {
  const now = Date.now();
  let n = 0;
  for (const word of Object.values(s.words)) if (isDue(word, now)) n++;
  return n;
};
const selectStreak = (s: LocalState): StreakSummary => streakSummary(s.activity, dayKey(Date.now(), s.prefs.timezone), s.longestStreak);
const sameStreak = (a: StreakSummary, b: StreakSummary) =>
  a.current === b.current && a.longest === b.longest && a.readToday === b.readToday && a.lastReadingDay === b.lastReadingDay;
const selectPrefs = (s: LocalState) => s.prefs;
const selectTotals = (s: LocalState): ProgressTotals => progressTotals(s, dayKey(Date.now(), s.prefs.timezone), Date.now());
const sameTotals = (a: ProgressTotals, b: ProgressTotals) =>
  a.xp === b.xp &&
  a.storiesRead === b.storiesRead &&
  a.wordsCollected === b.wordsCollected &&
  a.wordsDue === b.wordsDue &&
  a.journalEntries === b.journalEntries &&
  a.currentStreak === b.currentStreak &&
  a.bestStreak === b.bestStreak &&
  a.stampsUnlocked === b.stampsUnlocked;

/** Number of saved words. */
export function useWordCount(): number | null {
  return useLocal(selectWordCount);
}

/** Number of words due for practice now. */
export function useDueCount(): number | null {
  return useLocal(selectDueCount);
}

/** Current and longest streak, whether today already counts. */
export function useStreak(): StreakSummary | null {
  return useLocal(selectStreak, sameStreak);
}

/** Everything /me and the Today strip show (level, counts, streaks). */
export function useProgressTotals(): ProgressTotals | null {
  return useLocal(selectTotals, sameTotals);
}

export function usePrefs(): Prefs | null {
  return useLocal(selectPrefs);
}

/** The local read record for a story, or undefined when never opened. */
export function useReadRecord(slug: string): ReadRecord | undefined | null {
  const select = useCallback((s: LocalState) => getOwn(s.reads, slug), [slug]);
  return useLocal(select);
}

/** True once the story is finished on this device. */
export function useIsRead(slug: string): boolean | null {
  const select = useCallback((s: LocalState) => getOwn(s.reads, slug)?.completedAt !== undefined, [slug]);
  return useLocal(select);
}

/** The saved entry for a word (any case), or undefined when not saved. */
export function useWordEntry(word: string): WordEntry | undefined | null {
  const select = useCallback((s: LocalState) => getOwn(s.words, normalizeWordKey(word)), [word]);
  return useLocal(select);
}

/** Save reading prefs on this device. */
export function setPrefs(patch: Partial<Prefs>): void {
  dispatch({ type: 'setPrefs', prefs: patch });
}

/** Save and apply the theme choice. */
export function setThemePref(theme: ThemePref): void {
  dispatch({ type: 'setPrefs', prefs: { theme } });
  announceTheme(theme);
}
