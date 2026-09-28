import type { WordEntry } from '@/lib/local/schema';
import { dueCards, isDue } from '@/lib/progress/leitner';
import { dayKey, diffDays } from '@/lib/time';

/**
 * Pure helpers for /words and /words/practice (DESIGN §12.5, SPEC §8).
 * Isomorphic and deterministic: everything that depends on "now" or on
 * randomness takes it as an argument, so it can be unit-tested.
 */

export type WordSort = 'due' | 'az' | 'new';

export const WORD_SORTS: ReadonlyArray<{ value: WordSort; label: string }> = [
  { value: 'due', label: 'Due first' },
  { value: 'az', label: 'A–Z' },
  { value: 'new', label: 'Newest' },
];

/** Practice rounds hold at most this many cards (SPEC §8). */
export const ROUND_SIZE = 20;
/** "Practise anyway" when nothing is due: this many words (DESIGN §12.5). */
export const ANYWAY_SIZE = 3;

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Case- and accent-insensitive text for matching ("Café" → "cafe"). */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('en')
    .trim();
}

export function sortWords(words: readonly WordEntry[], sort: WordSort): WordEntry[] {
  const list = [...words];
  switch (sort) {
    case 'az':
      return list.sort((a, b) => collator.compare(a.word, b.word));
    case 'new':
      return list.sort((a, b) => b.createdAt - a.createdAt || collator.compare(a.word, b.word));
    case 'due':
      // Most overdue first; on ties the less known word (lower box) first, then A–Z.
      return list.sort((a, b) => a.dueAt - b.dueAt || a.box - b.box || collator.compare(a.word, b.word));
  }
}

/**
 * Words whose text starts with, or whose definition contains, the query.
 * Word matches rank first so typing "sta" finds "stamina" before a word that
 * merely mentions it.
 */
export function searchWords(words: readonly WordEntry[], query: string): WordEntry[] {
  const q = foldText(query);
  if (!q) return [...words];
  const inWord: WordEntry[] = [];
  const inDefinition: WordEntry[] = [];
  for (const entry of words) {
    if (foldText(entry.word).includes(q)) inWord.push(entry);
    else if (foldText(entry.definition).includes(q)) inDefinition.push(entry);
  }
  return [...inWord, ...inDefinition];
}

/** "Due now", "Later today", "Tomorrow", "In 3 days". */
export function dueLabel(entry: Pick<WordEntry, 'dueAt'>, now: number, timeZone: string): string {
  if (isDue(entry, now)) return 'Due now';
  const days = diffDays(dayKey(now, timeZone), dayKey(entry.dueAt, timeZone));
  if (days <= 0) return 'Later today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** How many saved words sit in each Leitner box (index 0 = box 1). */
export function boxCounts(words: Iterable<Pick<WordEntry, 'box'>>): [number, number, number, number, number] {
  const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const { box } of words) {
    const i = Math.min(5, Math.max(1, Math.round(box))) - 1;
    counts[i] += 1;
  }
  return counts;
}

export function countDue(words: Iterable<Pick<WordEntry, 'dueAt'>>, now: number): number {
  let n = 0;
  for (const word of words) if (isDue(word, now)) n += 1;
  return n;
}

/** The earliest upcoming due time, or null when there are no words. */
export function nextDueAt(words: Iterable<Pick<WordEntry, 'dueAt'>>): number | null {
  let next: number | null = null;
  for (const { dueAt } of words) if (next === null || dueAt < next) next = dueAt;
  return next;
}

/** "Your next word is due tomorrow." for the nothing-due state. */
export function nextDueSentence(words: readonly Pick<WordEntry, 'dueAt'>[], now: number, timeZone: string): string | null {
  const next = nextDueAt(words);
  if (next === null) return null;
  const label = dueLabel({ dueAt: next }, now, timeZone);
  if (label === 'Due now') return 'Your next word is due now.';
  if (label === 'Later today') return 'Your next word is due later today.';
  return `Your next word is due ${label === 'Tomorrow' ? 'tomorrow' : label.replace(/^In /, 'in ')}.`;
}

/** Fisher–Yates with an injectable random source (0 ≤ r < 1). */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type RoundMode = 'due' | 'any';

/**
 * The cards for a practice round: up to 20 due cards (most overdue first), or,
 * in "any" mode when nothing is due, 3 random saved words.
 */
export function buildRound(words: readonly WordEntry[], now: number, mode: RoundMode, random: () => number): WordEntry[] {
  const due = dueCards(words, now, ROUND_SIZE);
  if (due.length > 0 || mode === 'due') return due;
  return shuffled(words, random).slice(0, ANYWAY_SIZE);
}

export interface RoundResult {
  word: string;
  before: number;
  after: number;
}

/** "5 words practised. 3 moved up." */
export function roundSummary(results: readonly RoundResult[]): { practised: number; movedUp: number; sentence: string } {
  const practised = results.length;
  const movedUp = results.filter((r) => r.after > r.before).length;
  const first = practised === 1 ? '1 word practised.' : `${practised} words practised.`;
  const second = movedUp === 0 ? '' : ` ${movedUp} moved up.`;
  return { practised, movedUp, sentence: `${first}${second}` };
}

/** "Practise 5 words" / "Practise 1 word". */
export function practiseLabel(count: number): string {
  return count === 1 ? 'Practise 1 word' : `Practise ${count} words`;
}

/** "Practise anyway (3 random words)", fewer when fewer are saved. */
export function practiseAnywayLabel(saved: number): string {
  const n = Math.min(ANYWAY_SIZE, saved);
  return n === 1 ? 'Practise anyway (1 random word)' : `Practise anyway (${n} random words)`;
}
