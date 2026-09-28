import { describe, expect, it } from 'vitest';

import { addDays, dayKey, startOfDay, type DayKey } from '@/lib/time';

import { BADGE_IDS, BADGES, earnedBadges, isBadgeId, newlyEarnedBadges, type BadgeProgress } from './badges';
import { dueAfter, dueCards, intervalDays, isDue, newCardSchedule, scheduleReview, type CardSchedule } from './leitner';
import { LEVELS, levelForXp, levelProgress, levelUpBetween } from './levels';
import { badgeProgress, progressTotals, readingCalendar, stampWall, type StatsSource } from './stats';
import { currentStreak, longestStreak, readingDays, streakSummary } from './streak';
import { countWords, tokenizeWords } from './text';
import type { ActivityEntry } from './types';
import { cappedXp, journalXp, quizXp, totalActivityXp, xpEarnedOn } from './xp';

const DAY = 86_400_000;

function activity(day: DayKey, kind: ActivityEntry['kind'], xp = 0, ref?: string): ActivityEntry {
  return { day, kind, xp, at: Date.parse(`${day}T12:00:00Z`), ...(ref ? { ref } : {}) };
}

describe('xp', () => {
  it('scores quizzes: +5 per correct answer, +5 for a perfect score', () => {
    expect(quizXp(0, 5)).toBe(0);
    expect(quizXp(3, 5)).toBe(15);
    expect(quizXp(5, 5)).toBe(30);
    expect(quizXp(7, 5)).toBe(30);
    expect(quizXp(1, 0)).toBe(0);
    expect(quizXp(-1, 5)).toBe(0);
    expect(quizXp(2.5, 5)).toBe(0);
  });

  it('caps saved-word XP at 10 per day and review XP at 20 per day', () => {
    const day = '2026-09-27';
    const log: ActivityEntry[] = [];
    let wordXp = 0;
    for (let i = 0; i < 8; i++) {
      const xp = cappedXp(log, day, 'word', 2);
      log.push(activity(day, 'word', xp, `w${i}`));
      wordXp += xp;
    }
    expect(wordXp).toBe(10);
    let reviewXp = 0;
    for (let i = 0; i < 30; i++) {
      const xp = cappedXp(log, day, 'review', 1);
      log.push(activity(day, 'review', xp));
      reviewXp += xp;
    }
    expect(reviewXp).toBe(20);
    // A new day starts fresh; uncapped kinds pass through.
    expect(cappedXp(log, addDays(day, 1), 'word', 2)).toBe(2);
    expect(cappedXp(log, day, 'read', 10)).toBe(10);
    expect(xpEarnedOn(log, day, 'word')).toBe(10);
    expect(totalActivityXp(log)).toBe(30);
  });

  it('awards journal XP once, when the entry reaches its minimum (never below the floor)', () => {
    expect(journalXp(49, 50, false)).toBe(0);
    expect(journalXp(50, 50, false)).toBe(15);
    expect(journalXp(500, 50, true)).toBe(0);
    expect(journalXp(5, 1, false)).toBe(0);
    expect(journalXp(20, 1, false)).toBe(15);
  });
});

describe('text', () => {
  it('counts words, keeping contractions and hyphenated words together', () => {
    expect(countWords('')).toBe(0);
    expect(countWords("  Don't stop — well-known   café, 2026!  ")).toBe(5);
    expect(tokenizeWords("Don't stop — well-known café")).toEqual(["Don't", 'stop', 'well-known', 'café']);
    expect(tokenizeWords('Hello, world.')).toEqual(['Hello', 'world']);
  });
});

describe('levels', () => {
  it('maps XP to levels at the spec thresholds', () => {
    expect(LEVELS.map((l) => [l.name, l.minXp])).toEqual([
      ['Scribbler', 0],
      ['Reader', 100],
      ['Storyteller', 300],
      ['Wordsmith', 700],
      ['Editor', 1500],
      ['Author', 3000],
      ['Laureate', 6000],
    ]);
    expect(levelForXp(0).id).toBe('scribbler');
    expect(levelForXp(99).id).toBe('scribbler');
    expect(levelForXp(100).id).toBe('reader');
    expect(levelForXp(5999).id).toBe('author');
    expect(levelForXp(10_000).id).toBe('laureate');
  });

  it('reports progress towards the next level', () => {
    expect(levelProgress(150)).toMatchObject({ xpIntoLevel: 50, xpToNext: 150, progress: 0.25 });
    expect(levelProgress(150).next?.id).toBe('storyteller');
    expect(levelProgress(7000)).toMatchObject({ next: null, xpToNext: null, progress: 1 });
  });

  it('detects level-ups, including skipped levels', () => {
    expect(levelUpBetween(90, 110)?.id).toBe('reader');
    expect(levelUpBetween(90, 800)?.id).toBe('wordsmith');
    expect(levelUpBetween(110, 120)).toBeNull();
  });
});

describe('streak', () => {
  const today = '2026-09-27';

  it('counts consecutive reading days ending today', () => {
    const days = new Set([today, addDays(today, -1), addDays(today, -2), addDays(today, -4)]);
    expect(currentStreak(days, today)).toBe(3);
  });

  it('keeps the streak alive until today is over (ending yesterday)', () => {
    const days = new Set([addDays(today, -1), addDays(today, -2)]);
    expect(currentStreak(days, today)).toBe(2);
  });

  it('breaks after a missed day', () => {
    const days = new Set([addDays(today, -2), addDays(today, -3)]);
    expect(currentStreak(days, today)).toBe(0);
    expect(currentStreak(new Set(), today)).toBe(0);
  });

  it('only counts read and journal activity', () => {
    const log = [activity(today, 'word', 2), activity(today, 'review', 1), activity(addDays(today, -1), 'journal')];
    expect([...readingDays(log)]).toEqual([addDays(today, -1)]);
    expect(streakSummary(log, today)).toMatchObject({ current: 1, readToday: false, lastReadingDay: addDays(today, -1) });
  });

  it('finds the longest run anywhere in history', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'];
    expect(longestStreak(days)).toBe(4);
    expect(longestStreak([])).toBe(0);
    expect(streakSummary([], today, 12).longest).toBe(12);
  });

  it('survives a DST change: nightly reading in New York stays one day per night', () => {
    const zone = 'America/New_York';
    // 23:30 local on 7–10 March 2026 (clocks spring forward on the 8th).
    const log = ['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'].map((day) => {
      const at = startOfDay(day, zone) + 23.5 * 3_600_000 - (day === '2026-03-08' ? 3_600_000 : 0);
      return { day: dayKey(at, zone), kind: 'read' as const, xp: 10, at };
    });
    expect(log.map((e) => e.day)).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
    expect(currentStreak(readingDays(log), '2026-03-10')).toBe(4);
  });

  it('uses the device time zone: the same instants can be different days', () => {
    const at = Date.parse('2026-06-01T02:00:00Z');
    expect(dayKey(at, 'America/Los_Angeles')).toBe('2026-05-31');
    expect(dayKey(at, 'Europe/Berlin')).toBe('2026-06-01');
  });
});

describe('leitner', () => {
  const zone = 'Europe/Berlin';
  const now = Date.parse('2026-09-27T18:00:00Z'); // 20:00 in Berlin
  const tomorrowMidnight = startOfDay('2026-09-28', zone);
  const card = (box: number): CardSchedule => ({ box, dueAt: now, reviews: 3, lapses: 1 });

  it('uses the spec intervals', () => {
    expect([1, 2, 3, 4, 5].map(intervalDays)).toEqual([0, 1, 3, 7, 16]);
    expect(intervalDays(0)).toBe(0);
    expect(intervalDays(9)).toBe(16);
  });

  it('Again → box 1, due now, counts a lapse', () => {
    expect(scheduleReview(card(4), 'again', now, zone)).toEqual({ box: 1, dueAt: now, reviews: 4, lapses: 2 });
  });

  it('Good → next box, due at local midnight after its interval', () => {
    expect(scheduleReview(card(1), 'good', now, zone)).toMatchObject({ box: 2, dueAt: tomorrowMidnight });
    expect(scheduleReview(card(2), 'good', now, zone)).toMatchObject({ box: 3, dueAt: startOfDay('2026-09-30', zone) });
    expect(scheduleReview(card(5), 'good', now, zone)).toMatchObject({ box: 5, dueAt: startOfDay('2026-10-13', zone) });
  });

  it('Easy → two boxes up (max 5)', () => {
    expect(scheduleReview(card(1), 'easy', now, zone)).toMatchObject({ box: 3, dueAt: startOfDay('2026-09-30', zone) });
    expect(scheduleReview(card(4), 'easy', now, zone).box).toBe(5);
  });

  it('Hard → same box, half the interval rounded up to whole days', () => {
    expect(scheduleReview(card(1), 'hard', now, zone)).toMatchObject({ box: 1, dueAt: now });
    expect(scheduleReview(card(2), 'hard', now, zone)).toMatchObject({ box: 2, dueAt: tomorrowMidnight });
    expect(scheduleReview(card(3), 'hard', now, zone)).toMatchObject({ box: 3, dueAt: startOfDay('2026-09-29', zone) });
    expect(scheduleReview(card(5), 'hard', now, zone)).toMatchObject({ box: 5, dueAt: startOfDay('2026-10-05', zone) });
  });

  it('schedules across a DST change at local midnight', () => {
    const before = Date.parse('2026-10-24T20:00:00Z');
    expect(dueAfter(3, before, zone)).toBe(Date.parse('2026-10-26T23:00:00Z'));
  });

  it('starts new cards due now and lists due cards most overdue first', () => {
    expect(newCardSchedule(now)).toEqual({ box: 1, dueAt: now, reviews: 0, lapses: 0 });
    const cards = [
      { id: 'a', box: 2, dueAt: now - DAY },
      { id: 'b', box: 1, dueAt: now - DAY },
      { id: 'c', box: 1, dueAt: now + DAY },
      { id: 'd', box: 3, dueAt: now - 2 * DAY },
    ];
    expect(dueCards(cards, now).map((c) => c.id)).toEqual(['d', 'b', 'a']);
    expect(dueCards(cards, now, 2)).toHaveLength(2);
    expect(isDue({ dueAt: now }, now)).toBe(true);
  });
});

describe('badges', () => {
  const none: BadgeProgress = {
    storiesCompleted: 0,
    categoriesCompleted: 0,
    wordsSaved: 0,
    journalEntries: 0,
    hasPerfectQuiz: false,
    bestStreak: 0,
    reviews: 0,
  };

  it('has the twelve spec stamps', () => {
    expect(BADGE_IDS).toHaveLength(12);
    expect(BADGES.map((b) => b.id)).toEqual([...BADGE_IDS]);
    expect(isBadgeId('streak-7')).toBe(true);
    expect(isBadgeId('streak-8')).toBe(false);
  });

  it('awards nothing at the start', () => {
    expect(earnedBadges(none)).toEqual([]);
  });

  it.each([
    [{ storiesCompleted: 1 }, ['first-story']],
    [{ wordsSaved: 10 }, ['first-word', 'words-10']],
    [{ wordsSaved: 50 }, ['first-word', 'words-10', 'words-50']],
    [{ journalEntries: 5 }, ['first-entry', 'writer-5']],
    [{ hasPerfectQuiz: true }, ['perfect-quiz']],
    [{ bestStreak: 7 }, ['streak-3', 'streak-7']],
    [{ bestStreak: 30 }, ['streak-3', 'streak-7', 'streak-30']],
    [{ storiesCompleted: 4, categoriesCompleted: 4 }, ['first-story', 'all-four']],
    [{ reviews: 49 }, []],
    [{ reviews: 50 }, ['reviewer-50']],
  ] as Array<[Partial<BadgeProgress>, string[]]>)('awards %o → %o', (partial, expected) => {
    expect(earnedBadges({ ...none, ...partial })).toEqual(expected);
  });

  it('never re-awards a stamp', () => {
    const progress = { ...none, wordsSaved: 12 };
    expect(newlyEarnedBadges(progress, { 'first-word': { awardedAt: 1 } })).toEqual(['words-10']);
  });
});

describe('stats', () => {
  const today = '2026-09-27';
  const source: StatsSource = {
    xp: 142,
    longestStreak: 5,
    reads: {
      a: { category: 'art', completedAt: 1, quiz: { score: 5, total: 5 } },
      b: { category: 'games', completedAt: 2 },
      c: { category: 'games' },
    },
    words: { x: { dueAt: 0, reviews: 3 }, y: { dueAt: Number.MAX_SAFE_INTEGER, reviews: 1 } },
    journal: { e1: { wordCount: 30 }, e2: { wordCount: 0 } },
    activity: [activity(today, 'read', 10, 'a'), activity(addDays(today, -1), 'journal', 15, 'e1'), activity(addDays(today, -3), 'word', 2)],
    badges: { 'first-story': { awardedAt: 5 } },
  };

  it('totals the numbers /me shows', () => {
    expect(progressTotals(source, today, Date.parse('2026-09-27T12:00:00Z'))).toMatchObject({
      xp: 142,
      storiesRead: 2,
      wordsCollected: 2,
      wordsDue: 1,
      journalEntries: 1,
      currentStreak: 2,
      bestStreak: 5,
      stampsUnlocked: 1,
    });
  });

  it('feeds the stamp rules', () => {
    expect(badgeProgress(source, today)).toEqual({
      storiesCompleted: 2,
      categoriesCompleted: 2,
      wordsSaved: 2,
      journalEntries: 1,
      hasPerfectQuiz: true,
      bestStreak: 5,
      reviews: 4,
    });
  });

  it('builds a 12-week Monday-first calendar ending this week', () => {
    const calendar = readingCalendar(source.activity, today);
    expect(calendar).toHaveLength(12);
    expect(calendar.every((week) => week.length === 7)).toBe(true);
    const last = calendar[11];
    expect(last[0].day).toBe('2026-09-21');
    expect(last[6]).toMatchObject({ day: today, isToday: true, reading: true, xp: 10, intensity: 2 });
    expect(calendar[0][0].day).toBe('2026-07-06');
    const wordDay = calendar.flat().find((d) => d.day === addDays(today, -3));
    expect(wordDay).toMatchObject({ reading: false, activities: 1, intensity: 1 });
    const fresh = readingCalendar([], '2026-09-23');
    expect(fresh[11].filter((d) => d.isFuture).map((d) => d.day)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  });

  it('lists every stamp, locked ones with their hint', () => {
    const wall = stampWall(source.badges);
    expect(wall).toHaveLength(12);
    expect(wall[0]).toMatchObject({ id: 'first-story', unlocked: true, awardedAt: 5 });
    expect(wall[1]).toMatchObject({ id: 'first-word', unlocked: false, awardedAt: null, hint: 'Save a word to your collection.' });
  });
});
