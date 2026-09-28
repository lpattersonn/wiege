import { describe, expect, it } from 'vitest';

import { createInitialState } from '@/lib/local/schema';
import { DAY_MS } from '@/lib/time';

import {
  backupCopy,
  backupStatus,
  countPhrase,
  countsPhrase,
  isClearConfirmation,
  isEmptySummary,
  joinList,
  lastBackupLine,
  latestChangeAt,
  needsBackup,
  restoredMessage,
  savedOnLine,
} from './backup-core';

const NOW = Date.parse('2026-09-27T12:00:00Z');

describe('latestChangeAt', () => {
  it('is null for a fresh device', () => {
    expect(latestChangeAt(createInitialState(NOW, 'UTC'))).toBeNull();
  });

  it('finds the newest change across words, entries, reads and activity', () => {
    const state = createInitialState(NOW, 'UTC');
    state.words.gleam = { word: 'gleam', definition: 'shine', box: 1, dueAt: 0, reviews: 0, lapses: 0, createdAt: 100 };
    state.journal.a = { id: 'a', promptKind: 'free', prompt: 'p', body: 'b', wordCount: 1, createdAt: 50, updatedAt: 300 };
    state.reads.s = { title: 't', category: 'art', level: '7-8', startedAt: 10, completedAt: 200 };
    state.activity.push({ day: '2026-09-01', kind: 'review', xp: 1, at: 250 });
    expect(latestChangeAt(state)).toBe(300);
  });
});

describe('backupStatus', () => {
  it('does not nag before there is anything to keep', () => {
    const status = backupStatus(null, null, NOW);
    expect(status.kind).toBe('nothing');
    expect(needsBackup(status)).toBe(false);
  });

  it('reminds when no backup was ever saved', () => {
    const status = backupStatus(null, NOW - 1000, NOW);
    expect(status.kind).toBe('never');
    expect(needsBackup(status)).toBe(true);
    expect(backupCopy(status, NOW)).toEqual({ title: 'Last backup: never.', body: 'Save a backup file so a new device can have your words.' });
  });

  it('reminds when the backup is older than 14 days and progress was made since', () => {
    const last = NOW - 20 * DAY_MS;
    const status = backupStatus(last, NOW - DAY_MS, NOW);
    expect(status).toEqual({ kind: 'stale', at: last });
    expect(needsBackup(status)).toBe(true);
    expect(backupCopy(status, NOW).title).toBe('Last backup: 2 weeks ago.');
  });

  it('stays quiet when the backup already has everything, however old', () => {
    const last = NOW - 60 * DAY_MS;
    const status = backupStatus(last, last - 5, NOW);
    expect(status.kind).toBe('current');
    expect(needsBackup(status)).toBe(false);
  });

  it('notes recent changes without nagging', () => {
    const status = backupStatus(NOW - 3 * DAY_MS, NOW - 60_000, NOW);
    expect(status.kind).toBe('changed');
    expect(needsBackup(status)).toBe(false);
    expect(backupCopy(status, NOW).title).toBe('Last backup: 3 days ago.');
  });

  it('keeps every body short enough for two lines at 320px', () => {
    const statuses = [backupStatus(null, null, NOW), backupStatus(null, 1, NOW), backupStatus(1, 2, NOW), backupStatus(NOW - 1, NOW, NOW), backupStatus(NOW, 1, NOW)];
    for (const s of statuses) expect(backupCopy(s, NOW).body.length).toBeLessThanOrEqual(60);
  });
});

describe('copy helpers', () => {
  it('pluralises counts', () => {
    expect(countPhrase(1, 'word')).toBe('1 word');
    expect(countPhrase(4, 'entry')).toBe('4 entries');
    expect(countPhrase(0, 'stamp')).toBe('0 stamps');
    expect(countPhrase(2, 'finished story')).toBe('2 finished stories');
  });

  it('joins lists in plain English', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('matches the DESIGN restore toast', () => {
    expect(restoredMessage({ words: 23, journalEntries: 4, stamps: 3 })).toBe('Restored 23 words, 4 entries and 3 stamps.');
    expect(countsPhrase({ words: 1, journalEntries: 1, stamps: 1 })).toBe('1 word, 1 entry and 1 stamp');
  });

  it('spots an empty backup', () => {
    expect(isEmptySummary({ words: 0, journalEntries: 0, stamps: 0, storiesRead: 0, xp: 0 })).toBe(true);
    expect(isEmptySummary({ words: 0, journalEntries: 0, stamps: 0, storiesRead: 0, xp: 5 })).toBe(false);
  });

  it('dates the file in the student’s time zone', () => {
    const late = Date.parse('2026-09-27T23:30:00Z');
    expect(savedOnLine(late, 'UTC')).toBe('Saved on 27 September 2026.');
    expect(savedOnLine(late, 'Europe/Berlin')).toBe('Saved on 28 September 2026.');
    expect(savedOnLine(null, 'UTC')).toBeNull();
  });

  it('says when the last backup was', () => {
    expect(lastBackupLine(null, NOW)).toBe('Last backup: never.');
    expect(lastBackupLine(NOW - 2 * DAY_MS, NOW)).toBe('Last backup: 2 days ago.');
    expect(lastBackupLine(NOW - 10_000, NOW)).toBe('Last backup: just now.');
  });
});

describe('isClearConfirmation', () => {
  it('accepts clear in any case with spaces around it', () => {
    expect(isClearConfirmation('clear')).toBe(true);
    expect(isClearConfirmation('  Clear ')).toBe(true);
    expect(isClearConfirmation('CLEAR')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isClearConfirmation('')).toBe(false);
    expect(isClearConfirmation('clea')).toBe(false);
    expect(isClearConfirmation('clear everything')).toBe(false);
    expect(isClearConfirmation('yes')).toBe(false);
  });
});
