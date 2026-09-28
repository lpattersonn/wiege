import { describe, expect, it } from 'vitest';

import { BADGE_IDS } from '@/lib/progress/badges';
import { readingCalendar, stampWall } from '@/lib/progress/stats';
import type { ActivityEntry } from '@/lib/progress/types';

import {
  calendarRows,
  calendarSummary,
  cellMark,
  cellText,
  EARNED_CAPTIONS,
  formatCount,
  formatDayMonth,
  levelView,
  lockedCaption,
  orderStamps,
  readingDayCount,
  stampsSummary,
  streakView,
  weekHeaders,
} from './me-view';

const read = (day: string, at = Date.parse(`${day}T10:00:00Z`)): ActivityEntry => ({ day, kind: 'read', xp: 10, at });

describe('levelView', () => {
  it('shows the next level and the XP still needed', () => {
    const view = levelView(560);
    expect(view).toMatchObject({ name: 'Storyteller', number: 3, total: 7, min: 300, max: 700, toNext: '140 XP to Wordsmith', isTop: false });
  });

  it('starts at Scribbler with 100 XP to Reader', () => {
    expect(levelView(0)).toMatchObject({ name: 'Scribbler', number: 1, min: 0, max: 100, toNext: '100 XP to Reader' });
  });

  it('formats large numbers and handles the top level', () => {
    expect(levelView(4200).toNext).toBe('1,800 XP to Laureate');
    const top = levelView(7250);
    expect(top).toMatchObject({ name: 'Laureate', number: 7, isTop: true, toNext: 'Top level reached' });
    expect(top.max).toBeGreaterThan(top.min);
  });

  it('never goes negative', () => {
    expect(levelView(-20)).toMatchObject({ xp: 0, name: 'Scribbler' });
    expect(formatCount(-3)).toBe('0');
  });
});

describe('streakView', () => {
  it('asks for today’s read when the streak is alive from yesterday', () => {
    const view = streakView({ current: 12, longest: 12, readToday: false, lastReadingDay: '2026-09-26' });
    expect(view.kind).toBe('active');
    expect(view.count).toBe(12);
    expect(view.caption).toBe('Read one story today to make it 13.');
    expect(view.tally).toEqual({ count: 12, pending: true, label: '12 tally marks, one for each day in a row. Today’s mark is waiting.' });
  });

  it('confirms today once it counts, with singular copy for one day', () => {
    const view = streakView({ current: 1, longest: 4, readToday: true, lastReadingDay: '2026-09-27' });
    expect(view.unit).toBe('day in a row');
    expect(view.caption).toBe('Today’s mark is in. Read tomorrow to make it 2.');
    expect(view.tally.pending).toBe(false);
    expect(view.tally.label).toBe('1 tally mark, one for each day in a row.');
  });

  it('never shows a zero in big type when a streak ends', () => {
    const view = streakView({ current: 0, longest: 9, readToday: false, lastReadingDay: '2026-09-20' });
    expect(view.kind).toBe('broken');
    expect(view.headline).toBe('Welcome back.');
    expect(view.caption).toBe('Start a new line today. Your longest run is 9 days.');
    expect(view.caption).not.toMatch(/lost|broke/i);
  });

  it('welcomes a brand-new reader', () => {
    const view = streakView({ current: 0, longest: 0, readToday: false, lastReadingDay: null });
    expect(view.kind).toBe('new');
    expect(view.headline).toBe('Day one is waiting.');
    expect(view.tally).toMatchObject({ count: 0, pending: true });
  });
});

describe('reading calendar table', () => {
  const today = '2026-09-27'; // a Sunday
  const activity = [read('2026-09-27'), read('2026-09-21'), read('2026-08-03'), { day: '2026-09-25', kind: 'word', xp: 2, at: 1 } as ActivityEntry];
  const columns = readingCalendar(activity, today, 12);

  it('transposes 12 week columns into 7 weekday rows', () => {
    const rows = calendarRows(columns);
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.short)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(rows.every((r) => r.cells.length === 12)).toBe(true);
    expect(rows[0].cells[0].day).toBe('2026-07-06');
    expect(rows[6].cells[11].day).toBe('2026-09-27');
  });

  it('labels weeks for screen readers and months where they begin', () => {
    const headers = weekHeaders(columns);
    expect(headers[0]).toMatchObject({ start: '2026-07-06', label: 'Week of 6 July', month: 'Jul' });
    expect(headers.filter((h) => h.month !== null).map((h) => h.month)).toEqual(['Jul', 'Aug', 'Sep']);
    // August 1st is a Saturday: its label sits on the week of 27 July.
    expect(headers[3]).toMatchObject({ start: '2026-07-27', month: 'Aug' });
  });

  it('drops the first column’s label when the next month starts right after', () => {
    const cols = readingCalendar([], '2026-10-11', 12); // first week: 20 July; August 1st is in week 2
    const headers = weekHeaders(cols);
    expect(headers[0].month).toBeNull();
    expect(headers[1].month).toBe('Aug');
  });

  it('describes each cell without colour', () => {
    const rows = calendarRows(columns);
    const sunday = rows[6].cells;
    expect(cellMark(sunday[11])).toBe('today-read');
    expect(cellMark(rows[0].cells[11])).toBe('read'); // Monday 21 September
    expect(cellMark(rows[4].cells[11])).toBe('none'); // Friday 25 September: words only, not a reading day
    expect(cellText('today-waiting')).toBe('Today, not yet');
    expect(cellText('none')).toBe('No reading');
  });

  it('marks days after today as still to come', () => {
    const midweek = readingCalendar([], '2026-09-23', 12);
    const rows = calendarRows(midweek);
    expect(cellMark(rows[2].cells[11])).toBe('today-waiting');
    expect(cellMark(rows[3].cells[11])).toBe('future');
  });

  it('counts reading days honestly', () => {
    expect(readingDayCount(columns)).toBe(3);
    expect(calendarSummary(columns)).toBe('You read on 3 days in the last 12 weeks.');
    expect(calendarSummary(readingCalendar([], today, 12))).toBe('No reading days yet. Each day you read gets a slash.');
  });

  it('formats day keys without a time zone shift', () => {
    expect(formatDayMonth('2026-03-01')).toBe('1 March');
  });
});

describe('stamps wall', () => {
  it('puts earned stamps first and keeps the catalogue order in each group', () => {
    const wall = stampWall({ 'streak-3': { awardedAt: 5 }, 'first-story': { awardedAt: 9 } });
    const ordered = orderStamps(wall);
    expect(ordered.slice(0, 2).map((s) => s.id)).toEqual(['first-story', 'streak-3']);
    expect(ordered.slice(2).every((s) => !s.unlocked)).toBe(true);
    expect(ordered).toHaveLength(12);
    expect(stampsSummary(wall)).toBe('2 of 12 earned.');
  });

  it('has an earned caption for every stamp and a Next: line for locked ones', () => {
    for (const id of BADGE_IDS) expect(EARNED_CAPTIONS[id]).toMatch(/^You .+\.$/);
    expect(lockedCaption('Finish your first story.')).toBe('Next: finish your first story.');
  });

  it('summarises the empty and complete walls', () => {
    expect(stampsSummary(stampWall({}))).toBe('None earned yet, 12 to go.');
    const all = Object.fromEntries(BADGE_IDS.map((id) => [id, { awardedAt: 1 }]));
    expect(stampsSummary(stampWall(all))).toBe('All 12 earned.');
  });
});
