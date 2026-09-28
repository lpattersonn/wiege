import { describe, expect, it } from 'vitest';

import { tokenizeWords } from '@/lib/progress/text';
import { scanText } from '@/lib/news/safety';

import { baseCandidates, containsWord, sameWordFamily } from './word-forms';
import { COMMON_LONG_WORDS, TIER2_WORDS, tier2Entry } from './wordlists';

describe('TIER2_WORDS', () => {
  it('has about 400 unique words and spellings', () => {
    expect(TIER2_WORDS.length).toBeGreaterThanOrEqual(380);
    const spellings = TIER2_WORDS.flatMap((e) => [e.word, ...e.variants]);
    expect(new Set(spellings).size).toBe(spellings.length);
    for (const spelling of spellings) expect(spelling).toMatch(/^[a-z]+$/);
  });

  it('has kid-friendly definitions that do not use the word itself', () => {
    for (const entry of TIER2_WORDS) {
      expect(entry.definition, entry.word).toMatch(/^[a-z]/);
      expect(entry.definition, entry.word).not.toMatch(/\.$/);
      expect(entry.definition.length, entry.word).toBeLessThanOrEqual(110);
      for (const spelling of [entry.word, ...entry.variants]) {
        expect(containsWord(entry.definition, spelling), `${entry.word}: definition uses the word`).toBe(false);
      }
    }
  });

  it('has an everyday example sentence that uses a form of the word', () => {
    for (const entry of TIER2_WORDS) {
      expect(entry.example, entry.word).toMatch(/^[A-Z"].*[.?!]$/);
      const used = tokenizeWords(entry.example).some((token) =>
        [entry.word, ...entry.variants].some((spelling) => sameWordFamily(token, spelling)),
      );
      expect(used, `${entry.word}: "${entry.example}"`).toBe(true);
    }
  });

  it('passes the kid-safety scan', () => {
    for (const entry of TIER2_WORDS) {
      expect(scanText(`${entry.word} ${entry.definition} ${entry.example}`).reasons, entry.word).toEqual([]);
    }
  });

  it('looks up headwords and spelling variants', () => {
    expect(tier2Entry('Analyse')?.partOfSpeech).toBe('verb');
    expect(tier2Entry('analyze')?.word).toBe('analyse');
    expect(tier2Entry('constructor')).toBeUndefined();
    expect(tier2Entry('__proto__')).toBeUndefined();
  });
});

describe('COMMON_LONG_WORDS', () => {
  it('holds lower-case everyday words', () => {
    expect(COMMON_LONG_WORDS.size).toBeGreaterThan(300);
    for (const word of COMMON_LONG_WORDS) expect(word).toMatch(/^[a-z]{6,}$/);
    expect(COMMON_LONG_WORDS.has('something')).toBe(true);
  });
});

describe('word forms', () => {
  it('maps inflections to dictionary forms with the right word class', () => {
    const bases = (word: string) => baseCandidates(word).map((c) => c.base);
    expect(bases('discoveries')).toContain('discovery');
    expect(bases('committed')).toContain('commit');
    expect(bases('achieving')).toContain('achieve');
    expect(bases('boxes')).toContain('box');
    expect(bases('bolder')).toContain('bold');
    expect(baseCandidates('revealed').find((c) => c.base === 'reveal')?.classes).toEqual(['verb']);
    expect(baseCandidates("player's")[0].base).toBe('player');
    expect(baseCandidates('significantly', { derivations: true }).map((c) => c.base)).toContain('significant');
    expect(baseCandidates('significantly').map((c) => c.base)).not.toContain('significant');
  });

  it('never produces bases shorter than three letters', () => {
    for (const word of ['used', 'bed', 'ties', 'aced', 'sing']) {
      for (const c of baseCandidates(word)) expect(c.base.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('matches whole words only', () => {
    expect(containsWord('A remarkable day.', 'remarkable')).toBe(true);
    expect(containsWord('Unremarkable.', 'remarkable')).toBe(false);
    expect(containsWord('Café culture', 'café')).toBe(true);
    expect(containsWord('Nothing here', '')).toBe(false);
    expect(containsWord('Cost (approx.) 3', 'approx.')).toBe(true);
  });
});
