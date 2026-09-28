import type { JournalEntry, JournalPromptKind } from '@/lib/local/schema';
import { WRITING_PROMPT_KINDS } from '@/lib/literacy/types';
import { FREE_WRITE_MIN_WORDS } from '@/lib/progress/xp';
import { dayKey, diffDays } from '@/lib/time';

/**
 * Pure helpers for the journal pages and the writing editor (DESIGN §12.6,
 * §11.12). Isomorphic; "now" is always passed in.
 */

/** The prompt shape the editor takes (the WritingEditor props contract). */
export interface PromptInput {
  id: string;
  kind: string;
  prompt: string;
  minWords: number;
  maxWords: number;
  tips: string[];
}

export const PROMPT_KIND_LABELS: Readonly<Record<JournalPromptKind, string>> = {
  summary: 'Summary',
  headline: 'Headline',
  opinion: 'Opinion',
  creative: 'Creative writing',
  letter: 'Letter',
  free: 'Free write',
};

const KINDS: ReadonlySet<string> = new Set(WRITING_PROMPT_KINDS);

/** Any prompt kind string as a journal kind ('free' for anything unknown). */
export function toJournalKind(kind: string): JournalPromptKind {
  return KINDS.has(kind) ? (kind as JournalPromptKind) : 'free';
}

export function kindLabel(kind: string): string {
  return PROMPT_KIND_LABELS[toJournalKind(kind)];
}

export const FREE_PROMPT_ID = 'free';
export const FREE_PROMPT_TEXT = 'Write about anything you like: something you read, something you noticed, or an idea you want to try.';
export const FREE_STORY_PROMPT_TEXT = 'Write about this story in your own way: what stayed with you, what surprised you, or what you would ask the people in it.';

/** The free-write prompt (no maximum length). */
export function freePrompt(aboutStory = false): PromptInput {
  return {
    id: FREE_PROMPT_ID,
    kind: 'free',
    prompt: aboutStory ? FREE_STORY_PROMPT_TEXT : FREE_PROMPT_TEXT,
    minWords: FREE_WRITE_MIN_WORDS,
    maxWords: 0,
    tips: aboutStory
      ? ['Start with the moment or idea you remember best.', 'Use one of the story’s words in a sentence of your own.', 'Finish with a question you still have.']
      : ['Write the way you would tell a friend.', 'Add one detail that only you would notice.', 'Read it back once and fix anything that trips you up.'],
  };
}

/** Target length: `max` is null for "no maximum" (free writes, or a malformed range). */
export function wordTarget(prompt: Pick<PromptInput, 'minWords' | 'maxWords'>): { min: number; max: number | null } {
  const min = Math.max(1, Math.round(Number.isFinite(prompt.minWords) && prompt.minWords > 0 ? prompt.minWords : FREE_WRITE_MIN_WORDS));
  const rawMax = Math.round(prompt.maxWords);
  const max = Number.isFinite(rawMax) && rawMax >= min ? rawMax : null;
  return { min, max };
}

/** "aim for 30 to 80" / "aim for 50 or more". */
export function targetText(target: { min: number; max: number | null }): string {
  return target.max === null ? `aim for ${target.min} or more` : `aim for ${target.min} to ${target.max}`;
}

/** Where the draft stands against its target. */
export function targetState(words: number, target: { min: number; max: number | null }): 'empty' | 'short' | 'in-range' | 'long' {
  if (words === 0) return 'empty';
  if (words < target.min) return 'short';
  if (target.max !== null && words > target.max) return 'long';
  return 'in-range';
}

/** A fresh entry id (safe as a URL segment and a record key). */
export function newEntryId(random: () => number = Math.random, now: number = Date.now()): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  const rand = Array.from({ length: 12 }, () => Math.floor(random() * 36).toString(36)).join('');
  return `${now.toString(36)}-${rand}`;
}

/** First few words of the draft, for a free write's list title. */
export function draftOpening(body: string, maxWords = 8): string {
  const words = body.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return '';
  const head = words.slice(0, maxWords).join(' ').replace(/[\s,;:–—-]+$/, '');
  return words.length > maxWords ? `${head}…` : head;
}

/** The row title: the story's title, else the opening of a free write. */
export function entryTitle(entry: Pick<JournalEntry, 'storyTitle' | 'body' | 'promptKind'>): string {
  if (entry.storyTitle) return entry.storyTitle;
  const opening = draftOpening(entry.body);
  return opening || PROMPT_KIND_LABELS[entry.promptKind];
}

/** Entries with any writing in them, newest first. */
export function listEntries(journal: Readonly<Record<string, JournalEntry>>): JournalEntry[] {
  return Object.values(journal)
    .filter((entry) => entry.body.trim().length > 0)
    .sort((a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt);
}

/**
 * The entry to continue for a story prompt: the most recently updated entry
 * with the same story and prompt text. Free writes without a story never
 * resume (each "New entry" is new).
 */
export function findResumableEntry(
  journal: Readonly<Record<string, JournalEntry>>,
  storySlug: string | undefined,
  promptText: string,
): JournalEntry | null {
  if (!storySlug) return null;
  let best: JournalEntry | null = null;
  for (const entry of Object.values(journal)) {
    if (entry.storySlug !== storySlug || entry.prompt !== promptText) continue;
    if (!best || entry.updatedAt > best.updatedAt) best = entry;
  }
  return best;
}

// Day keys are formatted at UTC noon, so format in UTC (the key already is the local day).
const MONTH_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "Today", "Yesterday", "12 Sep", "12 Sep 2025" in the student's time zone. */
export function dateLabel(at: number, now: number, timeZone: string): string {
  const day = dayKey(at, timeZone);
  const today = dayKey(now, timeZone);
  const days = diffDays(day, today);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return day.slice(0, 4) === today.slice(0, 4) ? MONTH_DAY.format(date) : MONTH_DAY_YEAR.format(date);
}

/** "1 word" / "38 words". */
export function wordsText(n: number): string {
  return n === 1 ? '1 word' : `${n} words`;
}
