import { z } from 'zod';

import { CategorySlugSchema } from '@/lib/categories';
import { GradeBand, WritingFeedback } from '@/lib/literacy/types';
import { newlyEarnedBadges, type BadgeId } from '@/lib/progress/badges';
import { newCardSchedule, REVIEW_GRADES, scheduleReview } from '@/lib/progress/leitner';
import { levelUpBetween, type Level } from '@/lib/progress/levels';
import { badgeProgress } from '@/lib/progress/stats';
import { currentStreak, readingDays } from '@/lib/progress/streak';
import { countWords, tokenizeWords } from '@/lib/progress/text';
import type { ActivityKind } from '@/lib/progress/types';
import { cappedXp, FREE_WRITE_MIN_WORDS, journalXp, quizXp, XP_RULES } from '@/lib/progress/xp';
import { addDays, dayKey, isValidTimeZone, type DayKey } from '@/lib/time';

import { mergeBackups } from './backup';
import {
  createInitialState,
  getOwn,
  isSafeKey,
  JournalPromptKind,
  LIMITS,
  LocalStateSchema,
  normalizeWordKey,
  PrefsSchema,
  WordEntrySchema,
  type JournalEntry,
  type LocalState,
  type Prefs,
  type ReadRecord,
  type WordEntry,
} from './schema';

/**
 * Pure reducers for every change to the on-device state (SPEC §4):
 * `(state, action, now) => { state, events }`. Awards (XP, streak, stamps,
 * levels per SPEC §7) are applied here and reported as events so the UI can
 * celebrate. Reducers never mutate their input, and return the very same state
 * object when an action changes nothing (repeat saves, unknown words, ...).
 */

const Key = z.string().refine(isSafeKey, 'invalid key');
const clipped = (max: number) => z.string().max(max);

/** A single word as tapped in a story: letters/digits, optionally with ' or - inside. */
export function isSaveableWord(word: string): boolean {
  const trimmed = word.trim();
  if (trimmed.length === 0 || trimmed.length > LIMITS.wordChars) return false;
  const tokens = tokenizeWords(trimmed);
  return tokens.length === 1 && tokens[0] === trimmed;
}

const StoryRefShape = {
  slug: Key,
  title: clipped(LIMITS.titleChars),
  category: CategorySlugSchema,
  level: GradeBand,
};

export const LocalActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startRead'), ...StoryRefShape }),
  z.object({ type: z.literal('completeRead'), ...StoryRefShape }),
  z
    .object({
      type: z.literal('submitQuiz'),
      ...StoryRefShape,
      score: z.number().int().nonnegative().max(50),
      total: z.number().int().positive().max(50),
      answers: z.array(z.number().int().min(-1).max(20)).max(50),
    })
    .refine((a) => a.score <= a.total, 'score cannot exceed total'),
  z.object({
    type: z.literal('saveWord'),
    word: z.string().refine(isSaveableWord, 'expected a single word'),
    definition: clipped(LIMITS.definitionChars),
    example: clipped(LIMITS.exampleChars).optional(),
    partOfSpeech: clipped(40).optional(),
    storySlug: clipped(LIMITS.keyChars).optional(),
    storyTitle: clipped(LIMITS.titleChars).optional(),
  }),
  z.object({ type: z.literal('removeWord'), word: clipped(LIMITS.wordChars) }),
  z.object({ type: z.literal('restoreWord'), entry: WordEntrySchema }),
  z.object({ type: z.literal('reviewWord'), word: clipped(LIMITS.wordChars), grade: z.enum(REVIEW_GRADES) }),
  z.object({
    type: z.literal('saveEntry'),
    entry: z.object({
      id: Key,
      storySlug: clipped(LIMITS.keyChars).optional(),
      storyTitle: clipped(LIMITS.titleChars).optional(),
      promptKind: JournalPromptKind,
      prompt: clipped(LIMITS.promptChars),
      body: clipped(LIMITS.bodyChars),
      /** Omit to keep existing feedback, `null` to clear it. */
      feedback: WritingFeedback.nullable().optional(),
    }),
    /** The prompt's `minWords`; free writes default to FREE_WRITE_MIN_WORDS. */
    minWords: z.number().int().positive().max(5000).optional(),
  }),
  z.object({ type: z.literal('deleteEntry'), id: Key }),
  z.object({ type: z.literal('setPrefs'), prefs: PrefsSchema.partial() }),
  z.object({ type: z.literal('importBackup'), state: LocalStateSchema, mode: z.enum(['merge', 'replace']) }),
  z.object({ type: z.literal('clearAll') }),
]);

export type LocalAction = z.infer<typeof LocalActionSchema>;
export type LocalActionType = LocalAction['type'];
type ActionOf<T extends LocalActionType> = Extract<LocalAction, { type: T }>;

export interface LocalEvents {
  xpGained: number;
  newBadges: BadgeId[];
  levelUp: Level | null;
}

export interface ReduceResult {
  state: LocalState;
  events: LocalEvents;
}

export const noEvents = (): LocalEvents => ({ xpGained: 0, newBadges: [], levelUp: null });

interface Step {
  state: LocalState;
  xp: number;
}

interface Context {
  now: number;
  today: DayKey;
  timeZone: string;
}

const unchanged = (state: LocalState): Step => ({ state, xp: 0 });

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

/** `{ key: value }` only when `value` is a non-empty string, for optional fields. */
function optionalText<K extends string>(key: K, value: string | undefined, max: number): Partial<Record<K, string>> {
  const trimmed = value?.trim();
  return trimmed ? ({ [key]: clip(trimmed, max) } as Partial<Record<K, string>>) : {};
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) if (k !== key) out[k] = v;
  return out;
}

function withKey<T>(record: Readonly<Record<string, T>>, key: string, value: T): Record<string, T> {
  return { ...record, [key]: value };
}

function logActivity(state: LocalState, ctx: Context, kind: ActivityKind, xp: number, ref?: string): LocalState {
  const entry = { day: ctx.today, kind, xp, at: ctx.now, ...(ref !== undefined ? { ref } : {}) };
  return { ...state, xp: state.xp + xp, activity: [...state.activity, entry] };
}

function hasActivity(state: LocalState, kind: ActivityKind, ref: string, day?: DayKey, withXp = false): boolean {
  return state.activity.some(
    (e) => e.kind === kind && e.ref === ref && (day === undefined || e.day === day) && (!withXp || e.xp > 0),
  );
}

type StoryRef = Pick<ActionOf<'startRead'>, 'slug' | 'title' | 'category' | 'level'>;

function startRead(state: LocalState, a: ActionOf<'startRead'>, ctx: Context): Step {
  const existing = getOwn(state.reads, a.slug);
  if (existing) {
    if (existing.level === a.level) return unchanged(state);
    return unchanged({ ...state, reads: withKey(state.reads, a.slug, { ...existing, level: a.level }) });
  }
  if (Object.keys(state.reads).length >= LIMITS.reads) return unchanged(state);
  const record: ReadRecord = { title: clip(a.title, LIMITS.titleChars), category: a.category, level: a.level, startedAt: ctx.now };
  return unchanged({ ...state, reads: withKey(state.reads, a.slug, record) });
}

/** Finishing a story: +10 the first time; finishing again still counts as a reading day. */
function markCompleted(state: LocalState, story: StoryRef, ctx: Context): Step {
  const existing = getOwn(state.reads, story.slug);
  if (existing?.completedAt !== undefined) {
    if (hasActivity(state, 'read', story.slug, ctx.today)) return unchanged(state);
    return unchanged(logActivity(state, ctx, 'read', 0, story.slug));
  }
  if (!existing && Object.keys(state.reads).length >= LIMITS.reads) return unchanged(state);
  const record: ReadRecord = {
    ...(existing ?? { title: clip(story.title, LIMITS.titleChars), category: story.category, startedAt: ctx.now }),
    level: story.level,
    completedAt: ctx.now,
  };
  const next = { ...state, reads: withKey(state.reads, story.slug, record) };
  return { state: logActivity(next, ctx, 'read', XP_RULES.finishStory, story.slug), xp: XP_RULES.finishStory };
}

/** Quiz XP only for the first attempt; the best result is kept. Submitting also finishes the story. */
function submitQuiz(state: LocalState, a: ActionOf<'submitQuiz'>, ctx: Context): Step {
  if (a.score > a.total) return unchanged(state);
  const completed = markCompleted(state, a, ctx);
  let next = completed.state;
  const read = getOwn(next.reads, a.slug);
  if (!read) return completed;
  const result = { score: a.score, total: a.total, answers: a.answers.slice(0, 50) };
  const firstAttempt = read.quiz === undefined;
  const best = read.quiz && read.quiz.score > result.score ? read.quiz : result;
  next = { ...next, reads: withKey<ReadRecord>(next.reads, a.slug, { ...read, quiz: best }) };
  let xp = completed.xp;
  if (firstAttempt) {
    const earned = quizXp(a.score, a.total);
    if (earned > 0) {
      next = logActivity(next, ctx, 'quiz', earned, a.slug);
      xp += earned;
    }
  }
  return { state: next, xp };
}

/** +2 per new word (daily cap), once per word ever, so remove-and-save cannot farm XP. */
function saveWord(state: LocalState, a: ActionOf<'saveWord'>, ctx: Context): Step {
  if (!isSaveableWord(a.word)) return unchanged(state);
  const key = normalizeWordKey(a.word);
  if (getOwn(state.words, key) || Object.keys(state.words).length >= LIMITS.words) return unchanged(state);
  const entry: WordEntry = {
    word: a.word.trim(),
    definition: clip(a.definition.trim(), LIMITS.definitionChars),
    ...optionalText('example', a.example, LIMITS.exampleChars),
    ...optionalText('partOfSpeech', a.partOfSpeech, 40),
    ...optionalText('storySlug', a.storySlug, LIMITS.keyChars),
    ...optionalText('storyTitle', a.storyTitle, LIMITS.titleChars),
    ...newCardSchedule(ctx.now),
    createdAt: ctx.now,
  };
  let next: LocalState = { ...state, words: withKey(state.words, key, entry) };
  const xp = hasActivity(state, 'word', key) ? 0 : cappedXp(state.activity, ctx.today, 'word', XP_RULES.saveWord);
  if (xp > 0) next = logActivity(next, ctx, 'word', xp, key);
  return { state: next, xp };
}

function removeWord(state: LocalState, a: ActionOf<'removeWord'>): Step {
  const key = normalizeWordKey(a.word);
  if (!getOwn(state.words, key)) return unchanged(state);
  return unchanged({ ...state, words: withoutKey(state.words, key) });
}

/** Undo for removeWord: puts the exact record back (no XP). */
function restoreWord(state: LocalState, a: ActionOf<'restoreWord'>): Step {
  const key = normalizeWordKey(a.entry.word);
  if (!isSafeKey(key) || getOwn(state.words, key) || Object.keys(state.words).length >= LIMITS.words) return unchanged(state);
  return unchanged({ ...state, words: withKey(state.words, key, a.entry) });
}

function reviewWord(state: LocalState, a: ActionOf<'reviewWord'>, ctx: Context): Step {
  const key = normalizeWordKey(a.word);
  const word = getOwn(state.words, key);
  if (!word) return unchanged(state);
  const schedule = scheduleReview(word, a.grade, ctx.now, ctx.timeZone);
  let next: LocalState = { ...state, words: withKey(state.words, key, { ...word, ...schedule }) };
  const xp = cappedXp(state.activity, ctx.today, 'review', XP_RULES.review);
  if (xp > 0) next = logActivity(next, ctx, 'review', xp, key);
  return { state: next, xp };
}

function sameEntryContent(a: JournalEntry, b: JournalEntry): boolean {
  return (
    a.body === b.body &&
    a.prompt === b.prompt &&
    a.promptKind === b.promptKind &&
    a.storySlug === b.storySlug &&
    a.storyTitle === b.storyTitle &&
    JSON.stringify(a.feedback ?? null) === JSON.stringify(b.feedback ?? null)
  );
}

/**
 * Autosave target. +15 once per entry when it first reaches `minWords`; each day
 * an entry is written in also counts as a reading day. At most two activity
 * rows per entry per day, however often autosave fires.
 */
function saveEntry(state: LocalState, a: ActionOf<'saveEntry'>, ctx: Context): Step {
  const input = a.entry;
  const existing = getOwn(state.journal, input.id);
  if (!existing && Object.keys(state.journal).length >= LIMITS.journal) return unchanged(state);
  const body = clip(input.body, LIMITS.bodyChars);
  const feedback = input.feedback === undefined ? existing?.feedback : (input.feedback ?? undefined);
  const entry: JournalEntry = {
    id: input.id,
    ...optionalText('storySlug', input.storySlug, LIMITS.keyChars),
    ...optionalText('storyTitle', input.storyTitle, LIMITS.titleChars),
    promptKind: input.promptKind,
    prompt: clip(input.prompt, LIMITS.promptChars),
    body,
    wordCount: countWords(body),
    ...(feedback ? { feedback } : {}),
    createdAt: existing?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
  };
  if (existing && sameEntryContent(existing, entry)) return unchanged(state);

  let next: LocalState = { ...state, journal: withKey(state.journal, input.id, entry) };
  let xp = 0;
  if (entry.wordCount > 0) {
    const awarded = hasActivity(state, 'journal', input.id, undefined, true);
    xp = journalXp(entry.wordCount, a.minWords ?? FREE_WRITE_MIN_WORDS, awarded);
    if (xp > 0) next = logActivity(next, ctx, 'journal', xp, input.id);
    else if (!hasActivity(state, 'journal', input.id, ctx.today)) next = logActivity(next, ctx, 'journal', 0, input.id);
  }
  return { state: next, xp };
}

function deleteEntry(state: LocalState, a: ActionOf<'deleteEntry'>): Step {
  if (!getOwn(state.journal, a.id)) return unchanged(state);
  return unchanged({ ...state, journal: withoutKey(state.journal, a.id) });
}

function setPrefs(state: LocalState, a: ActionOf<'setPrefs'>): Step {
  const prefs: Prefs = { ...state.prefs };
  let changed = false;
  for (const key of Object.keys(PrefsSchema.shape) as Array<keyof Prefs>) {
    if (!Object.prototype.hasOwnProperty.call(a.prefs, key) || a.prefs[key] === undefined) continue;
    const parsed = PrefsSchema.shape[key].safeParse(a.prefs[key]);
    if (!parsed.success) continue;
    if (key === 'timezone' && !isValidTimeZone(String(parsed.data))) continue;
    if (prefs[key] !== parsed.data) {
      Object.assign(prefs, { [key]: parsed.data });
      changed = true;
    }
  }
  return unchanged(changed ? { ...state, prefs } : state);
}

function importBackup(state: LocalState, a: ActionOf<'importBackup'>): Step {
  return unchanged(a.mode === 'replace' ? a.state : mergeBackups(state, a.state));
}

function applyAction(state: LocalState, action: LocalAction, ctx: Context): Step {
  switch (action.type) {
    case 'startRead':
      return startRead(state, action, ctx);
    case 'completeRead':
      return markCompleted(state, action, ctx);
    case 'submitQuiz':
      return submitQuiz(state, action, ctx);
    case 'saveWord':
      return saveWord(state, action, ctx);
    case 'removeWord':
      return removeWord(state, action);
    case 'restoreWord':
      return restoreWord(state, action);
    case 'reviewWord':
      return reviewWord(state, action, ctx);
    case 'saveEntry':
      return saveEntry(state, action, ctx);
    case 'deleteEntry':
      return deleteEntry(state, action);
    case 'setPrefs':
      return setPrefs(state, action);
    case 'importBackup':
      return importBackup(state, action);
    case 'clearAll':
      return unchanged(createInitialState(ctx.now, state.prefs.timezone));
  }
}

function pruneActivity(state: LocalState, today: DayKey): LocalState {
  const cutoff = addDays(today, -LIMITS.activityDays);
  const tooOld = state.activity.some((e) => e.day < cutoff);
  if (!tooOld && state.activity.length <= LIMITS.activity) return state;
  const activity = state.activity.filter((e) => e.day >= cutoff).slice(-LIMITS.activity);
  return { ...state, activity };
}

/** Streak record, new stamps and level-up after any change. */
function finalize(prev: LocalState, step: Step, action: LocalAction, ctx: Context): ReduceResult {
  if (step.state === prev) return { state: prev, events: noEvents() };
  let state = pruneActivity(step.state, ctx.today);
  const streak = currentStreak(readingDays(state.activity), ctx.today);
  if (streak > state.longestStreak) state = { ...state, longestStreak: streak };
  const newBadges = newlyEarnedBadges(badgeProgress(state, ctx.today), state.badges);
  if (newBadges.length > 0) {
    const badges = { ...state.badges };
    for (const id of newBadges) badges[id] = { awardedAt: ctx.now };
    state = { ...state, badges };
  }
  // Restoring or clearing data is not an achievement: no level-up celebration.
  const celebrate = action.type !== 'importBackup' && action.type !== 'clearAll';
  return {
    state,
    events: { xpGained: step.xp, newBadges, levelUp: celebrate ? levelUpBetween(prev.xp, state.xp) : null },
  };
}

/** The single entry point: applies `action` at time `now` (epoch ms). */
export function reduceLocalState(state: LocalState, action: LocalAction, now: number): ReduceResult {
  const timeZone = state.prefs.timezone;
  const ctx: Context = { now, today: dayKey(now, timeZone), timeZone };
  return finalize(state, applyAction(state, action, ctx), action, ctx);
}
