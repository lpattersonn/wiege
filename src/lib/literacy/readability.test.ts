import { describe, expect, it } from 'vitest';

import {
  countSyllables,
  fleschKincaidGrade,
  lessonReadingGrade,
  lessonReadingMinutes,
  readingMinutes,
  splitSentences,
  textStatistics,
} from './readability';
import { getLandingDemoStory } from './samples';

// A spread of everyday and academic words with dictionary syllable counts.
const SYLLABLES: Record<string, number> = {
  cat: 1, the: 1, make: 1, makes: 1, made: 1, jumped: 1, played: 1, loved: 1, games: 1, lives: 1, goes: 1, free: 1, true: 1,
  wanted: 2, needed: 2, horses: 2, boxes: 2, wishes: 2, pages: 2, table: 2, little: 2, people: 2, happy: 2, water: 2,
  player: 2, playing: 2, being: 2, nation: 2, social: 2, special: 2, monkey: 2, athlete: 2, rhythm: 2, statue: 2,
  library: 3, beautiful: 3, character: 3, animal: 3, museum: 3, radio: 3, video: 3, actual: 3, usual: 3, media: 3,
  another: 3, important: 3, remember: 3, together: 3, festival: 3, gallery: 3, marathon: 3, volunteer: 3,
  experience: 4, criticism: 4, society: 4, variety: 4, geography: 4, biology: 4, community: 4, particular: 4,
  imagination: 5, electricity: 5, vocabulary: 5, opportunity: 5, 'université': 4, "player's": 2,
};

describe('countSyllables', () => {
  it('is close to dictionary counts on everyday and academic words', () => {
    const entries = Object.entries(SYLLABLES);
    const misses = entries.filter(([word, expected]) => countSyllables(word) !== expected);
    // The estimate is allowed a small error rate; readability formulas average over many words.
    expect(misses.length / entries.length).toBeLessThanOrEqual(0.1);
    for (const [word, expected] of misses) expect(Math.abs(countSyllables(word) - expected)).toBe(1);
  });

  it('handles empty input, numbers and non-Latin scripts', () => {
    expect(countSyllables('')).toBe(0);
    expect(countSyllables('   ')).toBe(0);
    expect(countSyllables('2026')).toBe(2);
    expect(countSyllables('東京')).toBe(1);
    expect(countSyllables('a')).toBe(1);
  });

  it('counts words that are Object.prototype keys as words (regression: "Bridge Constructor" gave NaN)', () => {
    for (const word of ['constructor', 'Constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf']) {
      expect(Number.isInteger(countSyllables(word)), word).toBe(true);
    }
    expect(countSyllables('constructor')).toBe(3);
    expect(Number.isFinite(fleschKincaidGrade('Bridge Constructor is back. The constructor built a bridge.'))).toBe(true);
  });
});

describe('splitSentences', () => {
  it('splits on terminal punctuation and keeps closing quotes', () => {
    expect(splitSentences('The team won. "What a day!" she said. Did they celebrate?')).toEqual([
      'The team won.',
      '"What a day!"',
      'she said.',
      'Did they celebrate?',
    ]);
  });

  it('does not split after abbreviations, initials or inside numbers', () => {
    expect(splitSentences('Dr. Lee met J. K. Rowling at 3.30 p.m. on Friday. It went well.')).toEqual([
      'Dr. Lee met J. K. Rowling at 3.30 p.m. on Friday.',
      'It went well.',
    ]);
  });

  it('treats line breaks as boundaries and keeps unpunctuated fragments', () => {
    expect(splitSentences('A headline\n\nthen some text without an end')).toEqual(['A headline', 'then some text without an end']);
    expect(splitSentences('...  !!! ')).toEqual([]);
    expect(splitSentences('')).toEqual([]);
  });

  it('keeps an ellipsis and repeated marks with their sentence', () => {
    expect(splitSentences('Wait... what?! Really.')).toEqual(['Wait...', 'what?!', 'Really.']);
  });
});

describe('readability scores', () => {
  it('rates simple text lower than dense text', () => {
    const simple = 'The dog ran. The cat sat. We had fun at the park.';
    const dense =
      'Contemporary architectural competitions increasingly evaluate environmental sustainability alongside aesthetic innovation, considering how communities will experience the completed buildings.';
    expect(fleschKincaidGrade(simple)).toBeLessThan(3);
    expect(fleschKincaidGrade(dense)).toBeGreaterThan(14);
    expect(fleschKincaidGrade('')).toBe(0);
  });

  it('computes text statistics', () => {
    expect(textStatistics('One two three. Four five.')).toMatchObject({ words: 5, sentences: 2, avgSentenceLength: 2.5 });
    expect(textStatistics('')).toMatchObject({ words: 0, sentences: 0, avgSentenceLength: 0, avgSyllablesPerWord: 0 });
  });

  it('estimates reading minutes by grade band (200 and 230 words per minute)', () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(200, '7-8')).toBe(1);
    expect(readingMinutes(201, '7-8')).toBe(2);
    expect(readingMinutes(460, '9-10')).toBe(2);
    expect(readingMinutes('word '.repeat(450), '7-8')).toBe(3);
  });

  it('scores a lesson by its Grade 7–8 retelling', () => {
    const { content } = getLandingDemoStory();
    expect(lessonReadingGrade(content)).toBeGreaterThan(3);
    expect(lessonReadingGrade(content)).toBeLessThan(10);
    expect(lessonReadingMinutes(content, '9-10')).toBeGreaterThanOrEqual(1);
  });
});
