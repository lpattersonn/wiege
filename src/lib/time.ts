/**
 * Local-day math in an IANA time zone. Isomorphic and dependency-free.
 *
 * A "day" is a calendar date string `YYYY-MM-DD` in the student's time zone.
 * Calendar arithmetic (`addDays`, `diffDays`) works on the date itself, never
 * on 24-hour multiples, so it is unaffected by DST changes; conversions between
 * instants and days go through `Intl.DateTimeFormat`.
 */

export type DayKey = string;

export const DAY_MS = 86_400_000;

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(at: number, timeZone: string): WallClock {
  const values: Record<string, number> = {};
  for (const part of wallClockFormatter(timeZone).formatToParts(at)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    // Some engines render midnight as 24 even with h23; normalise.
    hour: values.hour === 24 ? 0 : values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** A usable time zone: `timeZone` when valid, otherwise UTC. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : 'UTC';
}

/** The device's time zone (SPEC §4), falling back to UTC. */
export function defaultTimeZone(): string {
  try {
    return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return 'UTC';
  }
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

/** The calendar day containing instant `at` in `timeZone`. */
export function dayKey(at: number | Date, timeZone: string): DayKey {
  const { year, month, day } = wallClock(typeof at === 'number' ? at : at.getTime(), resolveTimeZone(timeZone));
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parseDayKey(value: string): { year: number; month: number; day: number } | null {
  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && parseDayKey(value) !== null;
}

function toUtcNoon(day: DayKey): number {
  const parsed = parseDayKey(day);
  if (!parsed) throw new RangeError(`Invalid day key: ${day}`);
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12);
}

function fromUtc(ms: number): DayKey {
  const date = new Date(ms);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Calendar arithmetic: `addDays('2026-03-31', 1) === '2026-04-01'`. */
export function addDays(day: DayKey, days: number): DayKey {
  return fromUtc(toUtcNoon(day) + Math.trunc(days) * DAY_MS);
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: DayKey, to: DayKey): number {
  return Math.round((toUtcNoon(to) - toUtcNoon(from)) / DAY_MS);
}

/** Offset of `timeZone` from UTC at instant `at`, in ms (e.g. +2 h for Berlin in summer). */
export function timeZoneOffsetMs(at: number, timeZone: string): number {
  const wall = wallClock(at, resolveTimeZone(timeZone));
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(at / 1000) * 1000;
}

/**
 * The first instant of `day` in `timeZone`. DST-safe, including zones whose
 * clocks jump at midnight (the day then starts at 01:00 local time).
 */
export function startOfDay(day: DayKey, timeZone: string): number {
  const zone = resolveTimeZone(timeZone);
  const parsed = parseDayKey(day);
  if (!parsed) throw new RangeError(`Invalid day key: ${day}`);
  const midnightUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  // The offset in force at local midnight is one of the offsets around it.
  const offsets = new Set([
    timeZoneOffsetMs(midnightUtc - DAY_MS, zone),
    timeZoneOffsetMs(midnightUtc, zone),
    timeZoneOffsetMs(midnightUtc + DAY_MS, zone),
  ]);
  const candidates = [...offsets].map((offset) => midnightUtc - offset).sort((a, b) => a - b);
  const starts = candidates.filter((t) => dayKey(t, zone) === day && dayKey(t - 1, zone) !== day);
  if (starts.length > 0) return starts[0];
  const inDay = candidates.filter((t) => dayKey(t, zone) === day);
  return inDay.length > 0 ? inDay[0] : candidates[0];
}

/** Monday = 0 ... Sunday = 6. */
export function weekdayIndex(day: DayKey): number {
  return (new Date(toUtcNoon(day)).getUTCDay() + 6) % 7;
}

/** The Monday on or before `day`. */
export function startOfWeek(day: DayKey): DayKey {
  return addDays(day, -weekdayIndex(day));
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * DAY_MS],
  ['month', 30 * DAY_MS],
  ['week', 7 * DAY_MS],
  ['day', DAY_MS],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "just now", "5 minutes ago", "2 hours ago", "yesterday", ... */
export function timeAgo(then: number, now: number, locale = 'en'): string {
  const elapsed = Math.max(0, now - then);
  if (elapsed < 60_000) return 'just now';
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (elapsed >= size) return format.format(-Math.floor(elapsed / size), unit);
  }
  return 'just now';
}
