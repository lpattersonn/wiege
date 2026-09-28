import { describe, expect, it } from 'vitest';

import {
  addDays,
  dayKey,
  diffDays,
  isDayKey,
  isValidTimeZone,
  parseDayKey,
  resolveTimeZone,
  startOfDay,
  startOfWeek,
  timeAgo,
  timeZoneOffsetMs,
  weekdayIndex,
} from './time';

const HOUR = 3_600_000;
const utc = (iso: string) => Date.parse(iso);

describe('dayKey', () => {
  const instant = utc('2026-03-08T04:30:00Z');

  it.each([
    ['UTC', '2026-03-08'],
    ['America/New_York', '2026-03-07'],
    ['America/Los_Angeles', '2026-03-07'],
    ['Europe/Berlin', '2026-03-08'],
    ['Asia/Tokyo', '2026-03-08'],
    ['Asia/Kolkata', '2026-03-08'],
    ['Pacific/Kiritimati', '2026-03-08'],
    ['Pacific/Pago_Pago', '2026-03-07'],
  ])('maps the same instant to the local calendar day in %s', (zone, expected) => {
    expect(dayKey(instant, zone)).toBe(expected);
  });

  it('accepts Date objects', () => {
    expect(dayKey(new Date('2026-12-31T23:59:59Z'), 'UTC')).toBe('2026-12-31');
  });

  it('falls back to UTC for an unknown zone', () => {
    expect(dayKey(utc('2026-01-01T01:00:00Z'), 'Mars/Olympus_Mons')).toBe('2026-01-01');
    expect(resolveTimeZone('Mars/Olympus_Mons')).toBe('UTC');
    expect(resolveTimeZone(undefined)).toBe('UTC');
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('flips days at local midnight, not UTC midnight', () => {
    expect(dayKey(utc('2026-06-15T21:59:59Z'), 'Europe/Berlin')).toBe('2026-06-15');
    expect(dayKey(utc('2026-06-15T22:00:00Z'), 'Europe/Berlin')).toBe('2026-06-16');
  });
});

describe('day keys and calendar arithmetic', () => {
  it('validates day keys, including impossible dates', () => {
    expect(isDayKey('2028-02-29')).toBe(true);
    expect(isDayKey('2026-02-29')).toBe(false);
    expect(isDayKey('2026-13-01')).toBe(false);
    expect(isDayKey('2026-1-01')).toBe(false);
    expect(isDayKey(20260101)).toBe(false);
    expect(parseDayKey('2026-09-27')).toEqual({ year: 2026, month: 9, day: 27 });
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-08', 0)).toBe('2026-03-08');
    expect(addDays('2026-03-01', 400)).toBe('2027-04-05');
  });

  it('counts whole calendar days regardless of DST', () => {
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(-2);
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365);
    expect(() => addDays('nope', 1)).toThrow(RangeError);
  });

  it('knows weekdays and week starts (Monday first)', () => {
    expect(weekdayIndex('2026-09-28')).toBe(0); // Monday
    expect(weekdayIndex('2026-09-27')).toBe(6); // Sunday
    expect(startOfWeek('2026-09-27')).toBe('2026-09-21');
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28');
  });
});

describe('startOfDay across DST boundaries', () => {
  it('handles the US spring-forward day (23 hours long)', () => {
    const start = startOfDay('2026-03-08', 'America/New_York');
    const next = startOfDay('2026-03-09', 'America/New_York');
    expect(start).toBe(utc('2026-03-08T05:00:00Z'));
    expect(next).toBe(utc('2026-03-09T04:00:00Z'));
    expect(next - start).toBe(23 * HOUR);
  });

  it('handles the US fall-back day (25 hours long)', () => {
    const start = startOfDay('2026-11-01', 'America/New_York');
    const next = startOfDay('2026-11-02', 'America/New_York');
    expect(start).toBe(utc('2026-11-01T04:00:00Z'));
    expect(next - start).toBe(25 * HOUR);
  });

  it('handles the EU transitions', () => {
    expect(startOfDay('2026-03-30', 'Europe/Berlin') - startOfDay('2026-03-29', 'Europe/Berlin')).toBe(23 * HOUR);
    expect(startOfDay('2026-10-26', 'Europe/Berlin') - startOfDay('2026-10-25', 'Europe/Berlin')).toBe(25 * HOUR);
    expect(startOfDay('2026-03-29', 'Europe/Berlin')).toBe(utc('2026-03-28T23:00:00Z'));
  });

  it('handles zones whose clocks jump at midnight (the day starts at 01:00)', () => {
    const zone = 'America/Santiago';
    for (const day of ['2026-09-05', '2026-09-06', '2026-09-07', '2026-04-05']) {
      const start = startOfDay(day, zone);
      expect(dayKey(start, zone)).toBe(day);
      expect(dayKey(start - 1, zone)).toBe(addDays(day, -1));
    }
  });

  it('is the first instant of the day for many zones and dates', () => {
    const zones = ['UTC', 'America/New_York', 'Europe/London', 'Australia/Sydney', 'Asia/Kathmandu', 'Pacific/Chatham'];
    const days = ['2026-01-01', '2026-03-08', '2026-03-29', '2026-04-05', '2026-10-04', '2026-10-25', '2026-11-01'];
    for (const zone of zones) {
      for (const day of days) {
        const start = startOfDay(day, zone);
        expect(dayKey(start, zone)).toBe(day);
        expect(dayKey(start - 1, zone)).toBe(addDays(day, -1));
      }
    }
  });

  it('reports UTC offsets that change with DST', () => {
    expect(timeZoneOffsetMs(utc('2026-01-15T12:00:00Z'), 'Europe/Berlin')).toBe(1 * HOUR);
    expect(timeZoneOffsetMs(utc('2026-07-15T12:00:00Z'), 'Europe/Berlin')).toBe(2 * HOUR);
    expect(timeZoneOffsetMs(utc('2026-07-15T12:00:00Z'), 'Asia/Kolkata')).toBe(5.5 * HOUR);
  });
});

describe('timeAgo', () => {
  const now = utc('2026-09-27T12:00:00Z');
  it('describes elapsed time in plain words', () => {
    expect(timeAgo(now - 10_000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(timeAgo(now - 2 * HOUR, now)).toBe('2 hours ago');
    expect(timeAgo(now - 26 * HOUR, now)).toBe('yesterday');
    expect(timeAgo(now + 5_000, now)).toBe('just now');
  });
});
