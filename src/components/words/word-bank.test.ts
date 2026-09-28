import { describe, expect, it } from 'vitest';

import type { WordEntry } from '@/lib/local/schema';
import { startOfDay } from '@/lib/time';

import {
  boxCounts,
  buildRound,
  countDue,
  dueLabel,
  foldText,
  nextDueSentence,
  practiseAnywayLabel,
  practiseLabel,
  roundSummary,
  searchWords,
  shuffled,
  sortWords,
} from './word-bank';

const TZ = 'Europe/Berlin';
const NOW = Date.UTC(2026, 8, 27, 10, 0, 0); // 12:00 in Berlin

function word(w: string, over: Partial<WordEntry> = {}): WordEntry {
  return { word: w, definition: `Meaning of ${w}.`, box: 1, dueAt: NOW, reviews: 0, lapses: 0, createdAt: NOW, ...over };
}

const midnightIn = (days: number) => startOfDay(`2026-09-${String(27 + days).padStart(2, '0')}`, TZ);

describe('sortWords', () => {
  const words = [
    word('momentum', { dueAt: NOW + 5000, box: 4, createdAt: 3 }),
    word('Stamina', { dueAt: NOW - 1000, box: 2, createdAt: 1 }),
    word('rehearse', { dueAt: NOW - 1000, box: 1, createdAt: 2 }),
  ];
  it('puts the most overdue, least known words first', () => {
    expect(sortWords(words, 'due').map((w) => w.word)).toEqual(['rehearse', 'Stamina', 'momentum']);
  });
  it('sorts A–Z ignoring case', () => {
    expect(sortWords(words, 'az').map((w) => w.word)).toEqual(['momentum', 'rehearse', 'Stamina']);
  });
  it('sorts newest first', () => {
    expect(sortWords(words, 'new').map((w) => w.word)).toEqual(['momentum', 'rehearse', 'Stamina']);
  });
  it('does not mutate its input', () => {
    const copy = [...words];
    sortWords(words, 'az');
    expect(words).toEqual(copy);
  });
});

describe('searchWords', () => {
  const words = [word('stamina', { definition: 'Strength to keep going.' }), word('momentum', { definition: 'The push that keeps a thing going.' }), word('café')];
  it('ranks word matches before definition matches', () => {
    expect(searchWords(words, 'going').map((w) => w.word)).toEqual(['stamina', 'momentum']);
    expect(searchWords(words, 'sta').map((w) => w.word)).toEqual(['stamina']);
  });
  it('ignores case and accents', () => {
    expect(searchWords(words, 'CAFE').map((w) => w.word)).toEqual(['café']);
    expect(foldText('  Résumé ')).toBe('resume');
  });
  it('returns everything for an empty query', () => {
    expect(searchWords(words, '   ')).toHaveLength(3);
  });
});

describe('dueLabel', () => {
  it('labels due, tomorrow and later days in the local time zone', () => {
    expect(dueLabel({ dueAt: NOW - 1 }, NOW, TZ)).toBe('Due now');
    expect(dueLabel({ dueAt: NOW }, NOW, TZ)).toBe('Due now');
    expect(dueLabel({ dueAt: NOW + 3_600_000 }, NOW, TZ)).toBe('Later today');
    expect(dueLabel({ dueAt: midnightIn(1) }, NOW, TZ)).toBe('Tomorrow');
    expect(dueLabel({ dueAt: midnightIn(3) }, NOW, TZ)).toBe('In 3 days');
  });
});

describe('counts', () => {
  it('counts words per box and due words', () => {
    const words = [word('a', { box: 1 }), word('b', { box: 3, dueAt: NOW + 1 }), word('c', { box: 5 }), word('d', { box: 9 })];
    expect(boxCounts(words)).toEqual([1, 0, 1, 0, 2]);
    expect(countDue(words, NOW)).toBe(3);
  });
  it('says when the next word is due', () => {
    expect(nextDueSentence([], NOW, TZ)).toBeNull();
    expect(nextDueSentence([{ dueAt: midnightIn(1) }, { dueAt: midnightIn(3) }], NOW, TZ)).toBe('Your next word is due tomorrow.');
    expect(nextDueSentence([{ dueAt: midnightIn(3) }], NOW, TZ)).toBe('Your next word is due in 3 days.');
  });
});

describe('buildRound', () => {
  const random = () => 0.5;
  it('takes at most 20 due cards, most overdue first', () => {
    const many = Array.from({ length: 25 }, (_, i) => word(`w${i}`, { dueAt: NOW - i }));
    const round = buildRound(many, NOW, 'due', random);
    expect(round).toHaveLength(20);
    expect(round[0].word).toBe('w24');
  });
  it('returns nothing when nothing is due in "due" mode', () => {
    expect(buildRound([word('a', { dueAt: NOW + 10 })], NOW, 'due', random)).toEqual([]);
  });
  it('picks 3 words when nothing is due in "any" mode', () => {
    const words = ['a', 'b', 'c', 'd', 'e'].map((w) => word(w, { dueAt: NOW + 10 }));
    const round = buildRound(words, NOW, 'any', random);
    expect(round).toHaveLength(3);
    expect(new Set(round.map((w) => w.word)).size).toBe(3);
  });
  it('still prefers due cards in "any" mode', () => {
    const words = [word('due'), word('later', { dueAt: NOW + 10 })];
    expect(buildRound(words, NOW, 'any', random).map((w) => w.word)).toEqual(['due']);
  });
});

describe('shuffled', () => {
  it('keeps every item exactly once', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffled(items, random).sort()).toEqual(items);
  });
});

describe('copy', () => {
  it('summarises a round', () => {
    expect(roundSummary([{ word: 'a', before: 1, after: 2 }, { word: 'b', before: 3, after: 1 }]).sentence).toBe('2 words practised. 1 moved up.');
    expect(roundSummary([{ word: 'a', before: 2, after: 2 }]).sentence).toBe('1 word practised.');
  });
  it('labels the practise buttons', () => {
    expect(practiseLabel(5)).toBe('Practise 5 words');
    expect(practiseLabel(1)).toBe('Practise 1 word');
    expect(practiseAnywayLabel(12)).toBe('Practise anyway (3 random words)');
    expect(practiseAnywayLabel(1)).toBe('Practise anyway (1 random word)');
  });
});
