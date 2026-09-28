import type { BackupSummary } from '@/lib/local/backup';
import type { LocalState } from '@/lib/local/schema';
import { DAY_MS, timeAgo } from '@/lib/time';

/**
 * Pure logic for backups on /me and /settings: when to remind, what the
 * restore preview and toasts say, and the type-to-confirm check. Isomorphic
 * and unit-tested.
 */

/** A backup older than this, with progress made since, counts as out of date. */
export const BACKUP_STALE_DAYS = 14;

/** The newest moment anything worth backing up changed, or null when there is nothing yet. */
export function latestChangeAt(state: Pick<LocalState, 'reads' | 'words' | 'journal' | 'activity' | 'badges' | 'xp'>): number | null {
  let latest = 0;
  let any = state.xp > 0;
  for (const read of Object.values(state.reads)) {
    any = true;
    latest = Math.max(latest, read.startedAt, read.completedAt ?? 0);
  }
  for (const word of Object.values(state.words)) {
    any = true;
    latest = Math.max(latest, word.createdAt);
  }
  for (const entry of Object.values(state.journal)) {
    any = true;
    latest = Math.max(latest, entry.updatedAt);
  }
  for (const award of Object.values(state.badges)) {
    if (!award) continue;
    any = true;
    latest = Math.max(latest, award.awardedAt);
  }
  for (const entry of state.activity) {
    any = true;
    latest = Math.max(latest, entry.at);
  }
  return any ? latest : null;
}

export type BackupStatus =
  | { kind: 'nothing' }
  | { kind: 'never' }
  | { kind: 'stale'; at: number }
  | { kind: 'changed'; at: number }
  | { kind: 'current'; at: number };

/**
 * - nothing: no progress yet, so no reminder
 * - never: progress, and no backup saved on this device
 * - stale: the backup is older than 14 days and progress has been made since (the reminder)
 * - changed: a recent backup, with some progress since
 * - current: the backup has everything
 */
export function backupStatus(lastBackupAt: number | null, changedAt: number | null, now: number, staleDays = BACKUP_STALE_DAYS): BackupStatus {
  if (changedAt === null) return { kind: 'nothing' };
  if (lastBackupAt === null) return { kind: 'never' };
  if (changedAt <= lastBackupAt) return { kind: 'current', at: lastBackupAt };
  if (now - lastBackupAt > staleDays * DAY_MS) return { kind: 'stale', at: lastBackupAt };
  return { kind: 'changed', at: lastBackupAt };
}

/** True when the student should be nudged to save a backup file. */
export function needsBackup(status: BackupStatus): boolean {
  return status.kind === 'never' || status.kind === 'stale';
}

/** "Last backup: never." / "Last backup: 3 days ago." */
export function lastBackupLine(lastBackupAt: number | null, now: number): string {
  return lastBackupAt === null ? 'Last backup: never.' : `Last backup: ${timeAgo(lastBackupAt, now)}.`;
}

export interface BackupCopy {
  title: string;
  body: string;
}

/** Copy for the /me backup panel (kept short: at most two lines at 320px). */
export function backupCopy(status: BackupStatus, now: number): BackupCopy {
  switch (status.kind) {
    case 'nothing':
      return { title: 'Nothing to back up yet.', body: 'Save words or finish a story, then back them up here.' };
    case 'never':
      return { title: 'Last backup: never.', body: 'Save a backup file so a new device can have your words.' };
    case 'stale':
      return { title: lastBackupLine(status.at, now), body: 'You’ve done more since then. Save a new backup file.' };
    case 'changed':
      return { title: lastBackupLine(status.at, now), body: 'Save a new one to include your newest progress.' };
    case 'current':
      return { title: lastBackupLine(status.at, now), body: 'Your backup has everything you’ve done so far.' };
  }
}

/* -------------------------------------------------------------------------- */
/* Restore preview and toasts                                                  */

const PLURALS: Record<string, string> = { word: 'words', entry: 'entries', stamp: 'stamps', story: 'stories', 'finished story': 'finished stories' };

/** "1 word", "23 words", "4 entries". */
export function countPhrase(n: number, singular: string): string {
  return `${n} ${n === 1 ? singular : (PLURALS[singular] ?? `${singular}s`)}`;
}

/** "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

type Counts = Pick<BackupSummary, 'words' | 'journalEntries' | 'stamps'>;

/** "23 words, 4 entries and 3 stamps" (DESIGN §10 backup copy). */
export function countsPhrase(summary: Counts): string {
  return joinList([countPhrase(summary.words, 'word'), countPhrase(summary.journalEntries, 'entry'), countPhrase(summary.stamps, 'stamp')]);
}

/** Toast after a restore: "Restored 23 words, 4 entries and 3 stamps." */
export function restoredMessage(summary: Counts): string {
  return `Restored ${countsPhrase(summary)}.`;
}

export function isEmptySummary(summary: Pick<BackupSummary, 'words' | 'journalEntries' | 'stamps' | 'storiesRead' | 'xp'>): boolean {
  return summary.words === 0 && summary.journalEntries === 0 && summary.stamps === 0 && summary.storiesRead === 0 && summary.xp === 0;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Saved on 27 September 2026." in the student's time zone, or null when the file has no date. */
export function savedOnLine(exportedAt: number | null, timeZone: string): string | null {
  if (exportedAt === null) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(new Date(exportedAt));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const day = get('day');
    const month = get('month');
    const year = get('year');
    if (!day || !month || !year) return null;
    return `Saved on ${day} ${MONTHS[month - 1]} ${year}.`;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Clear everything                                                           */

export const CLEAR_WORD = 'clear';

/** The student typed "clear" (any case, surrounding spaces ignored). */
export function isClearConfirmation(text: string): boolean {
  return text.trim().toLowerCase() === CLEAR_WORD;
}
