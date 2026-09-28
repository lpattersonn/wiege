import { totalActivityXp } from '@/lib/progress/xp';
import { dayKey, defaultTimeZone } from '@/lib/time';

import {
  LIMITS,
  LOCAL_STATE_VERSION,
  migrateLocalState,
  parseLocalState,
  safeJsonParse,
  type BadgeAwards,
  type JournalEntry,
  type LocalActivityEntry,
  type LocalState,
  type ReadRecord,
  type WordEntry,
} from './schema';

/**
 * Backup files (SPEC §4): export, strict parse (never trust a file) and merge.
 * Isomorphic; the only browser APIs used are Blob and Blob.text().
 */

export const BACKUP_FORMAT = 'wiege-backup';
export const BACKUP_MAX_BYTES = 2 * 1024 * 1024;

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  exportedAt: number;
  state: LocalState;
}

export interface BackupSummary {
  storiesRead: number;
  words: number;
  journalEntries: number;
  stamps: number;
  xp: number;
  exportedAt: number | null;
}

export type BackupErrorCode = 'empty' | 'too-large' | 'unreadable' | 'not-json' | 'not-wiege' | 'newer-version' | 'invalid';

export type ParseBackupResult =
  | { ok: true; state: LocalState; summary: BackupSummary }
  | { ok: false; code: BackupErrorCode; message: string };

const MESSAGES: Record<BackupErrorCode, string> = {
  empty: 'This file is empty. Choose the wiege-backup file you saved from Settings.',
  'too-large': 'This file is too big to be a Wiege backup (the limit is 2 MB). Choose the wiege-backup file you saved.',
  unreadable: "We couldn't open that file. Try choosing it again.",
  'not-json': "This file isn't a Wiege backup. Choose the wiege-backup file you saved from Settings.",
  'not-wiege': "This file isn't a Wiege backup. Choose the wiege-backup file you saved from Settings.",
  'newer-version': 'This backup was made by a newer version of Wiege. Reload the page, then try again.',
  invalid: 'This backup file is damaged, so nothing was changed. Try another backup file.',
};

const failure = (code: BackupErrorCode): ParseBackupResult => ({ ok: false, code, message: MESSAGES[code] });

export function serializeBackup(state: LocalState, now: number = Date.now()): string {
  const envelope: BackupEnvelope = { format: BACKUP_FORMAT, exportedAt: now, state };
  return JSON.stringify(envelope);
}

/** `wiege-backup-YYYY-MM-DD.json`, dated in the student's time zone. */
export function backupFilename(now: number = Date.now(), timeZone: string = defaultTimeZone()): string {
  return `wiege-backup-${dayKey(now, timeZone)}.json`;
}

/** The backup as a downloadable JSON Blob; name it with `backupFilename()`. */
export function exportBackup(state: LocalState, now: number = Date.now()): Blob {
  return new Blob([serializeBackup(state, now)], { type: 'application/json' });
}

export function summarizeState(state: LocalState, exportedAt: number | null = null): BackupSummary {
  return {
    storiesRead: Object.values(state.reads).filter((read) => read.completedAt !== undefined).length,
    words: Object.keys(state.words).length,
    journalEntries: Object.keys(state.journal).length,
    stamps: Object.keys(state.badges).length,
    xp: state.xp,
    exportedAt,
  };
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Synchronous core of `parseBackup`, for text already in memory. */
export function parseBackupText(text: string): ParseBackupResult {
  if (text.length > BACKUP_MAX_BYTES || utf8Length(text) > BACKUP_MAX_BYTES) return failure('too-large');
  if (text.trim() === '') return failure('empty');

  let raw: unknown;
  try {
    raw = safeJsonParse(text);
  } catch {
    return failure('not-json');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return failure('not-wiege');

  // Accept the envelope, or a bare state (older exports and hand-copied data).
  const record = raw as Record<string, unknown>;
  let candidate: unknown = raw;
  let exportedAt: number | null = null;
  if (record.format !== undefined || record.state !== undefined) {
    if (record.format !== BACKUP_FORMAT) return failure('not-wiege');
    candidate = record.state;
    exportedAt = typeof record.exportedAt === 'number' && Number.isFinite(record.exportedAt) ? record.exportedAt : null;
  } else if (!('version' in record) || !('prefs' in record)) {
    return failure('not-wiege');
  }

  const migrated = migrateLocalState(candidate);
  if (!migrated.ok) return failure(migrated.reason === 'newer-version' ? 'newer-version' : migrated.reason === 'not-object' ? 'not-wiege' : 'invalid');

  const parsed = parseLocalState(migrated.value);
  if (!parsed.ok) return failure('invalid');
  return { ok: true, state: parsed.state, summary: summarizeState(parsed.state, exportedAt) };
}

/** Reads and validates a backup chosen by the student (File/Blob) or given as text. */
export async function parseBackup(input: Blob | string): Promise<ParseBackupResult> {
  if (typeof input === 'string') return parseBackupText(input);
  if (input.size > BACKUP_MAX_BYTES) return failure('too-large');
  if (input.size === 0) return failure('empty');
  let text: string;
  try {
    text = await input.text();
  } catch {
    return failure('unreadable');
  }
  return parseBackupText(text);
}

// ---------------------------------------------------------------------------
// Merge

function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>, pick: (left: T, right: T) => T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(a)) out[key] = value;
  for (const [key, value] of Object.entries(b)) {
    out[key] = Object.prototype.hasOwnProperty.call(out, key) ? pick(out[key], value) : value;
  }
  return out;
}

const minDefined = (x: number | undefined, y: number | undefined) =>
  x === undefined ? y : y === undefined ? x : Math.min(x, y);

function mergeRead(a: ReadRecord, b: ReadRecord): ReadRecord {
  const lastTouched = (r: ReadRecord) => Math.max(r.startedAt, r.completedAt ?? 0);
  const newer = lastTouched(b) > lastTouched(a) ? b : a;
  const quiz = !a.quiz ? b.quiz : !b.quiz ? a.quiz : b.quiz.score > a.quiz.score ? b.quiz : a.quiz;
  const completedAt = minDefined(a.completedAt, b.completedAt);
  return {
    title: newer.title,
    category: newer.category,
    level: newer.level,
    startedAt: Math.min(a.startedAt, b.startedAt),
    ...(completedAt !== undefined ? { completedAt } : {}),
    ...(quiz ? { quiz } : {}),
  };
}

/** Words have no updatedAt: the copy with more practice wins, then the newer one. */
function mergeWord(a: WordEntry, b: WordEntry): WordEntry {
  if (b.reviews !== a.reviews) return b.reviews > a.reviews ? b : a;
  return b.createdAt > a.createdAt ? b : a;
}

const mergeEntry = (a: JournalEntry, b: JournalEntry): JournalEntry => (b.updatedAt > a.updatedAt ? b : a);

function mergeActivity(a: readonly LocalActivityEntry[], b: readonly LocalActivityEntry[]): LocalActivityEntry[] {
  const seen = new Map<string, LocalActivityEntry>();
  for (const entry of [...a, ...b]) {
    const key = `${entry.at}|${entry.kind}|${entry.ref ?? ''}|${entry.day}`;
    if (!seen.has(key)) seen.set(key, entry);
  }
  return [...seen.values()].sort((x, y) => x.at - y.at);
}

function mergeBadges(a: BadgeAwards, b: BadgeAwards): BadgeAwards {
  const out: BadgeAwards = { ...a };
  for (const [id, award] of Object.entries(b) as Array<[keyof BadgeAwards, NonNullable<BadgeAwards[keyof BadgeAwards]>]>) {
    const existing = out[id];
    out[id] = existing && existing.awardedAt <= award.awardedAt ? existing : award;
  }
  return out;
}

/** Keeps the `max` entries ranked highest by `rank`. */
function capRecord<T>(record: Record<string, T>, max: number, rank: (value: T) => number): Record<string, T> {
  const entries = Object.entries(record);
  if (entries.length <= max) return record;
  return Object.fromEntries(entries.sort(([, x], [, y]) => rank(y) - rank(x)).slice(0, max));
}

/** XP that no longer has activity behind it (the log is pruned after LIMITS.activityDays). */
const carriedXp = (state: LocalState) => Math.max(0, state.xp - totalActivityXp(state.activity));

/**
 * Merges two states: `a` is this device (its preferences win), `b` the backup.
 * Records are unioned by key (journal: newest `updatedAt` wins); activity is
 * unioned and de-duplicated; XP is recomputed from the merged activity plus the
 * larger pruned remainder, so merging the same backup twice never double-counts.
 */
export function mergeBackups(a: LocalState, b: LocalState): LocalState {
  const union = mergeActivity(a.activity, b.activity);
  return {
    version: LOCAL_STATE_VERSION,
    createdAt: Math.min(a.createdAt, b.createdAt),
    prefs: a.prefs,
    reads: capRecord(mergeRecords(a.reads, b.reads, mergeRead), LIMITS.reads, (r) => r.completedAt ?? r.startedAt),
    words: capRecord(mergeRecords(a.words, b.words, mergeWord), LIMITS.words, (w) => w.createdAt),
    journal: capRecord(mergeRecords(a.journal, b.journal, mergeEntry), LIMITS.journal, (e) => e.updatedAt),
    activity: union.slice(-LIMITS.activity),
    badges: mergeBadges(a.badges, b.badges),
    xp: totalActivityXp(union) + Math.max(carriedXp(a), carriedXp(b)),
    longestStreak: Math.max(a.longestStreak, b.longestStreak),
  };
}
