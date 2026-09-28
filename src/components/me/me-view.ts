import { BADGE_IDS, type BadgeId } from '@/lib/progress/badges';
import { LEVELS, levelIndexForXp, levelProgress } from '@/lib/progress/levels';
import type { CalendarDay, StampState } from '@/lib/progress/stats';
import type { StreakSummary } from '@/lib/progress/streak';
import { parseDayKey, type DayKey } from '@/lib/time';

/**
 * Pure view logic for /me (DESIGN §11.13–§11.15, §12.7): the level line, the
 * big streak, the 12-week calendar table and the stamps wall. Isomorphic and
 * unit-tested; the client islands only render what these return.
 */

const numberFormat = new Intl.NumberFormat('en');

/** "1,240" — tabular numbers are set in Atkinson by the caller. */
export function formatCount(n: number): string {
  return numberFormat.format(Math.max(0, Math.floor(n)));
}

/* -------------------------------------------------------------------------- */
/* Level                                                                      */

export interface LevelView {
  name: string;
  /** 1-based position in the ladder ("Level 3 of 7"). */
  number: number;
  total: number;
  xp: number;
  /** Progress bar bounds: the current level's floor to the next level's floor. */
  min: number;
  max: number;
  /** "140 XP to Wordsmith", or the top-level line. */
  toNext: string;
  isTop: boolean;
}

export function levelView(xp: number): LevelView {
  const safe = Math.max(0, Math.floor(xp));
  const progress = levelProgress(safe);
  const index = levelIndexForXp(safe);
  const next = progress.next;
  return {
    name: progress.level.name,
    number: index + 1,
    total: LEVELS.length,
    xp: safe,
    min: progress.level.minXp,
    max: next ? next.minXp : Math.max(safe, progress.level.minXp + 1),
    toNext: next && progress.xpToNext !== null ? `${formatCount(progress.xpToNext)} XP to ${next.name}` : 'Top level reached',
    isTop: next === null,
  };
}

/* -------------------------------------------------------------------------- */
/* Streak (big form)                                                          */

export interface StreakView {
  /** 'active': a live streak (big numeral); 'broken': had one, it ended; 'new': never read yet. */
  kind: 'active' | 'broken' | 'new';
  /** The big numeral (active only). */
  count: number;
  /** "day in a row" / "days in a row" (active only). */
  unit: string;
  /** Replaces the numeral when there is no live streak: never show a zero in big type. */
  headline: string | null;
  caption: string;
  tally: { count: number; pending: boolean; label: string };
}

export function streakView(summary: StreakSummary): StreakView {
  const { current, longest, readToday } = summary;
  if (current > 0) {
    const label = `${current} tally mark${current === 1 ? '' : 's'}, one for each day in a row.${readToday ? '' : ' Today’s mark is waiting.'}`;
    return {
      kind: 'active',
      count: current,
      unit: current === 1 ? 'day in a row' : 'days in a row',
      headline: null,
      caption: readToday
        ? `Today’s mark is in. Read tomorrow to make it ${current + 1}.`
        : `Read one story today to make it ${current + 1}.`,
      tally: { count: current, pending: !readToday, label },
    };
  }
  if (longest > 0) {
    return {
      kind: 'broken',
      count: 0,
      unit: '',
      headline: 'Welcome back.',
      caption: `Start a new line today. Your longest run is ${longest} ${longest === 1 ? 'day' : 'days'}.`,
      tally: { count: 0, pending: true, label: 'No tally marks yet. Today’s mark is waiting.' },
    };
  }
  return {
    kind: 'new',
    count: 0,
    unit: '',
    headline: 'Day one is waiting.',
    caption: 'Read one story today to draw your first mark.',
    tally: { count: 0, pending: true, label: 'No tally marks yet. Today’s mark is waiting.' },
  };
}

/* -------------------------------------------------------------------------- */
/* Reading calendar (a real <table>: rows are weekdays, columns are weeks)     */

export const WEEKDAYS = [
  { name: 'Monday', short: 'Mon', labelled: true },
  { name: 'Tuesday', short: 'Tue', labelled: false },
  { name: 'Wednesday', short: 'Wed', labelled: true },
  { name: 'Thursday', short: 'Thu', labelled: false },
  { name: 'Friday', short: 'Fri', labelled: true },
  { name: 'Saturday', short: 'Sat', labelled: false },
  { name: 'Sunday', short: 'Sun', labelled: false },
] as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "6 July" from a day key (no time zone involved: the key already is the local day). */
export function formatDayMonth(day: DayKey): string {
  const parsed = parseDayKey(day);
  return parsed ? `${parsed.day} ${MONTHS[parsed.month - 1]}` : day;
}

function monthShort(month: number): string {
  return MONTHS[month - 1].slice(0, 3);
}

export interface WeekHeader {
  /** The week's Monday. */
  start: DayKey;
  /** Screen-reader column header: "Week of 6 July". */
  label: string;
  /** Short month shown above the column where a month begins ("Aug"), else null. */
  month: string | null;
}

/**
 * Column headers. A month label sits above the week containing that month's
 * 1st; the first column is labelled with its own month only when the next
 * label is at least 3 columns away (so labels never collide).
 */
export function weekHeaders(columns: readonly (readonly CalendarDay[])[]): WeekHeader[] {
  const headers: WeekHeader[] = columns.map((week) => {
    const first = week.find((d) => parseDayKey(d.day)?.day === 1);
    const parsed = first ? parseDayKey(first.day) : null;
    return { start: week[0].day, label: `Week of ${formatDayMonth(week[0].day)}`, month: parsed ? monthShort(parsed.month) : null };
  });
  if (headers.length > 0 && headers[0].month === null) {
    const nextLabelled = headers.findIndex((h, i) => i > 0 && h.month !== null);
    if (nextLabelled === -1 || nextLabelled >= 3) {
      const parsed = parseDayKey(headers[0].start);
      if (parsed) headers[0] = { ...headers[0], month: monthShort(parsed.month) };
    }
  }
  return headers;
}

export interface CalendarRow {
  name: string;
  short: string;
  labelled: boolean;
  cells: CalendarDay[];
}

/** Transposes week columns (Monday-first) into seven weekday rows. */
export function calendarRows(columns: readonly (readonly CalendarDay[])[]): CalendarRow[] {
  return WEEKDAYS.map((weekday, index) => ({
    ...weekday,
    cells: columns.map((week) => week[index]),
  }));
}

export type CellMark = 'read' | 'none' | 'today-read' | 'today-waiting' | 'future';

export function cellMark(day: CalendarDay): CellMark {
  if (day.isFuture) return 'future';
  if (day.isToday) return day.reading ? 'today-read' : 'today-waiting';
  return day.reading ? 'read' : 'none';
}

/** The text alternative inside each cell (row and column headers give the date). */
export function cellText(mark: CellMark): string {
  switch (mark) {
    case 'read':
      return 'Read';
    case 'none':
      return 'No reading';
    case 'today-read':
      return 'Today, read';
    case 'today-waiting':
      return 'Today, not yet';
    case 'future':
      return 'Still to come';
  }
}

/** Reading days shown in the calendar (up to today). */
export function readingDayCount(columns: readonly (readonly CalendarDay[])[]): number {
  let n = 0;
  for (const week of columns) for (const day of week) if (day.reading && !day.isFuture) n++;
  return n;
}

export function calendarSummary(columns: readonly (readonly CalendarDay[])[]): string {
  const n = readingDayCount(columns);
  if (n === 0) return 'No reading days yet. Each day you read gets a slash.';
  return `You read on ${n} ${n === 1 ? 'day' : 'days'} in the last 12 weeks.`;
}

/* -------------------------------------------------------------------------- */
/* Stamps                                                                     */

/** "How it was earned" for earned stamps (BADGES only has the locked hint). */
export const EARNED_CAPTIONS: Record<BadgeId, string> = {
  'first-story': 'You finished your first story.',
  'first-word': 'You saved your first word.',
  'words-10': 'You collected 10 words.',
  'words-50': 'You collected 50 words.',
  'first-entry': 'You wrote your first journal entry.',
  'perfect-quiz': 'You got every question right.',
  'streak-3': 'You read 3 days in a row.',
  'streak-7': 'You read 7 days in a row.',
  'streak-30': 'You read 30 days in a row.',
  'all-four': 'You finished a story in every category.',
  'writer-5': 'You wrote 5 journal entries.',
  'reviewer-50': 'You practised 50 flashcards.',
};

/** "Next: finish your first story." */
export function lockedCaption(hint: string): string {
  return `Next: ${hint.charAt(0).toLowerCase()}${hint.slice(1)}`;
}

/** Earned stamps first, then locked ones; each group keeps the catalogue order. */
export function orderStamps(wall: readonly StampState[]): StampState[] {
  const rank = (id: BadgeId) => BADGE_IDS.indexOf(id);
  return [...wall].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || rank(a.id) - rank(b.id));
}

export function stampsSummary(wall: readonly StampState[]): string {
  const earned = wall.filter((s) => s.unlocked).length;
  if (earned === 0) return `None earned yet, ${wall.length} to go.`;
  if (earned === wall.length) return `All ${wall.length} earned.`;
  return `${earned} of ${wall.length} earned.`;
}
