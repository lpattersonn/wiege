import { z } from 'zod';

import { CategorySlugSchema } from '@/lib/categories';
import { GradeBand, WRITING_PROMPT_KINDS, WritingFeedback } from '@/lib/literacy/types';
import { BADGE_IDS, type BadgeId } from '@/lib/progress/badges';
import { ACTIVITY_KINDS } from '@/lib/progress/types';
import { defaultTimeZone, isDayKey } from '@/lib/time';

/**
 * The on-device student state (SPEC §4), versioned and validated with zod.
 * Isomorphic. Nothing here ever leaves the device except in a backup file the
 * student saves themselves.
 *
 * Records are keyed by untrusted strings (slugs, words, ids). Read them with
 * `getOwn()` / `Object.hasOwn()`, never `record[key]`: a saved word such as
 * "constructor" is a legitimate own key, and an unsaved one would otherwise
 * resolve to `Object.prototype.constructor`.
 */

export const LOCAL_STATE_VERSION = 1;
export const STORAGE_KEY = 'wiege:v1';

export const LIMITS = {
  reads: 5000,
  words: 5000,
  journal: 2000,
  activity: 6000,
  /** Activity older than this many days is pruned (streak records survive in `longestStreak`). */
  activityDays: 400,
  titleChars: 300,
  wordChars: 60,
  definitionChars: 1000,
  exampleChars: 600,
  promptChars: 1000,
  bodyChars: 20_000,
  keyChars: 200,
} as const;

const MAX_TIMESTAMP = 8.64e15;

/** `__proto__` is the one key that cannot round-trip through a plain object safely. */
export function isSafeKey(key: string): boolean {
  return key.length > 0 && key.length <= LIMITS.keyChars && key !== '__proto__';
}

const SafeKey = z.string().refine(isSafeKey, 'invalid key');
const Timestamp = z.number().int().nonnegative().max(MAX_TIMESTAMP);
const DayKeySchema = z.string().refine(isDayKey, 'expected YYYY-MM-DD');
const Count = z.number().int().nonnegative().max(1_000_000);
const text = (max: number) => z.string().max(max);

/** Lookup that ignores inherited properties (see the note at the top of this file). */
export function getOwn<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

/** Key under which a word is stored: trimmed, NFC, lower-case ("Resilient " → "resilient"). */
export function normalizeWordKey(word: string): string {
  return word.normalize('NFC').trim().toLocaleLowerCase('en');
}

const TIME_ZONE_PATTERN = /^[A-Za-z0-9_+\-/]{1,64}$/;

export const PrefsSchema = z.object({
  gradeBand: GradeBand.nullable(),
  readingFont: z.enum(['book', 'clear']),
  textSize: z.enum(['s', 'm', 'l', 'xl']),
  lineSpacing: z.enum(['normal', 'relaxed', 'loose']),
  theme: z.enum(['system', 'light', 'dark']),
  aiFeedback: z.boolean(),
  readAloudRate: z.number().min(0.5).max(2),
  /** IANA zone; validated loosely because zone support differs between browsers. */
  timezone: z.string().regex(TIME_ZONE_PATTERN),
});
export type Prefs = z.infer<typeof PrefsSchema>;

export const QuizResultSchema = z
  .object({
    score: z.number().int().nonnegative().max(50),
    total: z.number().int().positive().max(50),
    answers: z.array(z.number().int().min(-1).max(20)).max(50),
  })
  .refine((quiz) => quiz.score <= quiz.total, 'score cannot exceed total');
export type QuizResult = z.infer<typeof QuizResultSchema>;

export const ReadRecordSchema = z.object({
  title: text(LIMITS.titleChars),
  category: CategorySlugSchema,
  level: GradeBand,
  startedAt: Timestamp,
  completedAt: Timestamp.optional(),
  quiz: QuizResultSchema.optional(),
});
export type ReadRecord = z.infer<typeof ReadRecordSchema>;

export const WordEntrySchema = z.object({
  word: text(LIMITS.wordChars).min(1),
  definition: text(LIMITS.definitionChars),
  example: text(LIMITS.exampleChars).optional(),
  partOfSpeech: text(40).optional(),
  storySlug: text(LIMITS.keyChars).optional(),
  storyTitle: text(LIMITS.titleChars).optional(),
  box: z.number().int().min(1).max(5),
  dueAt: Timestamp,
  reviews: Count,
  lapses: Count,
  createdAt: Timestamp,
});
export type WordEntry = z.infer<typeof WordEntrySchema>;

export const JOURNAL_PROMPT_KINDS = [...WRITING_PROMPT_KINDS, 'free'] as const;
export const JournalPromptKind = z.enum(JOURNAL_PROMPT_KINDS);
export type JournalPromptKind = z.infer<typeof JournalPromptKind>;

export const JournalEntrySchema = z.object({
  id: SafeKey,
  storySlug: text(LIMITS.keyChars).optional(),
  storyTitle: text(LIMITS.titleChars).optional(),
  promptKind: JournalPromptKind,
  prompt: text(LIMITS.promptChars),
  body: text(LIMITS.bodyChars),
  wordCount: Count,
  feedback: WritingFeedback.optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const ActivityEntrySchema = z.object({
  day: DayKeySchema,
  kind: z.enum(ACTIVITY_KINDS),
  xp: z.number().int().nonnegative().max(1000),
  ref: text(LIMITS.keyChars).optional(),
  at: Timestamp,
});
export type LocalActivityEntry = z.infer<typeof ActivityEntrySchema>;

export const BadgeAwardSchema = z.object({ awardedAt: Timestamp });
export type BadgeAward = z.infer<typeof BadgeAwardSchema>;
export type BadgeAwards = Partial<Record<BadgeId, BadgeAward>>;

function boundedRecord<T extends z.ZodType>(value: T, max: number) {
  return z
    .record(SafeKey, value)
    .refine((record) => Object.keys(record).length <= max, `at most ${max} entries`);
}

/** Unknown stamp ids (e.g. from a newer app version) are dropped rather than rejected. */
const BadgesSchema = z.record(SafeKey, BadgeAwardSchema).transform((record): BadgeAwards => {
  const out: BadgeAwards = {};
  for (const id of BADGE_IDS) {
    const award = getOwn(record, id);
    if (award) out[id] = award;
  }
  return out;
});

export const LocalStateSchema = z
  .object({
    version: z.literal(LOCAL_STATE_VERSION),
    createdAt: Timestamp,
    prefs: PrefsSchema,
    reads: boundedRecord(ReadRecordSchema, LIMITS.reads),
    words: boundedRecord(WordEntrySchema, LIMITS.words),
    journal: boundedRecord(JournalEntrySchema, LIMITS.journal),
    activity: z.array(ActivityEntrySchema).max(LIMITS.activity),
    badges: BadgesSchema,
    xp: z.number().int().nonnegative().max(100_000_000),
    longestStreak: Count,
  })
  .superRefine((state, ctx) => {
    for (const [key, word] of Object.entries(state.words)) {
      if (key !== normalizeWordKey(word.word)) {
        ctx.addIssue({ code: 'custom', path: ['words', key], message: 'word key does not match the word' });
      }
    }
    for (const [key, entry] of Object.entries(state.journal)) {
      if (key !== entry.id) ctx.addIssue({ code: 'custom', path: ['journal', key], message: 'entry key does not match its id' });
    }
  });
export type LocalState = z.infer<typeof LocalStateSchema>;

export const DEFAULT_PREFS: Omit<Prefs, 'timezone'> = {
  gradeBand: null,
  readingFont: 'book',
  textSize: 'm',
  lineSpacing: 'normal',
  theme: 'system',
  aiFeedback: true,
  readAloudRate: 1,
};

export function createInitialState(now: number, timezone: string = defaultTimeZone()): LocalState {
  return {
    version: LOCAL_STATE_VERSION,
    createdAt: now,
    prefs: { ...DEFAULT_PREFS, timezone: TIME_ZONE_PATTERN.test(timezone) ? timezone : 'UTC' },
    reads: {},
    words: {},
    journal: {},
    activity: [],
    badges: {},
    xp: 0,
    longestStreak: 0,
  };
}

/** JSON.parse that drops `__proto__` keys, for any text from storage or a backup file. */
export function safeJsonParse(text: string): unknown {
  return JSON.parse(text, (key, value: unknown) => (key === '__proto__' ? undefined : value));
}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * Upgrades from version N to N + 1. Add an entry here (and bump
 * LOCAL_STATE_VERSION and the storage key if the layout changes) whenever the
 * shape changes; old backups then keep importing.
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export type MigrationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'not-object' | 'unknown-version' | 'newer-version' };

export function migrateLocalState(raw: unknown): MigrationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, reason: 'not-object' };
  let value = raw as Record<string, unknown>;
  let version = value.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { ok: false, reason: 'unknown-version' };
  if (version > LOCAL_STATE_VERSION) return { ok: false, reason: 'newer-version' };
  while (version < LOCAL_STATE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, reason: 'unknown-version' };
    value = { ...step(value), version: version + 1 };
    version += 1;
  }
  return { ok: true, value };
}

/** Strict validation (backups): the whole state is valid or nothing is accepted. */
export function parseLocalState(raw: unknown): { ok: true; state: LocalState } | { ok: false; reason: string } {
  const migrated = migrateLocalState(raw);
  if (!migrated.ok) return { ok: false, reason: migrated.reason };
  const parsed = LocalStateSchema.safeParse(migrated.value);
  return parsed.success ? { ok: true, state: parsed.data } : { ok: false, reason: 'invalid' };
}

function salvageRecord<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  max: number,
  keyFor: (value: T, key: string) => string,
): Record<string, T> {
  const out: Record<string, T> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= max) break;
    const parsed = schema.safeParse(value);
    if (!parsed.success) continue;
    const finalKey = keyFor(parsed.data, key);
    if (!isSafeKey(finalKey) || Object.prototype.hasOwnProperty.call(out, finalKey)) continue;
    out[finalKey] = parsed.data;
    count += 1;
  }
  return out;
}

/**
 * Lenient load for this device's own storage: keeps every valid part and drops
 * only what is broken, so one bad record never wipes a student's progress.
 * Returns null when nothing usable is there (or it is from a newer version).
 */
export function salvageLocalState(raw: unknown, now: number, fallbackTimezone: string = defaultTimeZone()): LocalState | null {
  const strict = parseLocalState(raw);
  if (strict.ok) return strict.state;
  const migrated = migrateLocalState(raw);
  if (!migrated.ok) return null;
  const value = migrated.value;
  const base = createInitialState(now, fallbackTimezone);

  const prefsRaw = typeof value.prefs === 'object' && value.prefs !== null ? (value.prefs as Record<string, unknown>) : {};
  const prefs: Prefs = { ...base.prefs };
  for (const key of Object.keys(PrefsSchema.shape) as Array<keyof Prefs>) {
    const field = PrefsSchema.shape[key].safeParse(prefsRaw[key]);
    if (field.success) Object.assign(prefs, { [key]: field.data });
  }

  const activity = Array.isArray(value.activity)
    ? value.activity
        .map((entry) => ActivityEntrySchema.safeParse(entry))
        .filter((result) => result.success)
        .map((result) => result.data)
        .slice(-LIMITS.activity)
    : [];

  const badges = BadgesSchema.safeParse(value.badges);
  const createdAt = Timestamp.safeParse(value.createdAt);
  const xp = z.number().int().nonnegative().max(100_000_000).safeParse(value.xp);
  const longest = Count.safeParse(value.longestStreak);

  return {
    version: LOCAL_STATE_VERSION,
    createdAt: createdAt.success ? createdAt.data : now,
    prefs,
    reads: salvageRecord(value.reads, ReadRecordSchema, LIMITS.reads, (_, key) => key),
    words: salvageRecord(value.words, WordEntrySchema, LIMITS.words, (word) => normalizeWordKey(word.word)),
    journal: salvageRecord(value.journal, JournalEntrySchema, LIMITS.journal, (entry) => entry.id),
    activity,
    badges: badges.success ? badges.data : {},
    xp: xp.success ? xp.data : 0,
    longestStreak: longest.success ? longest.data : 0,
  };
}
