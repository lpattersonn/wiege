import { describe, expect, it } from 'vitest';

import { findWord, firstSentenceWith, segmentLevel, type Segment } from './segment';
import { findEvidence, findPassage, lookupKey, quotedPassages, sentenceAround, wordBoundsAt } from './text';

const words = (segments: Segment[]) => segments.filter((s) => s.kind === 'word');
const joined = (segments: Segment[]) =>
  segments.map((s) => (s.kind === 'text' ? s.text : `${s.leading}${s.text}${s.trailing}`)).join('');

describe('findWord', () => {
  it('matches whole words without regard to case', () => {
    expect(findWord('Their first Prototype was cardboard.', 'prototype')).toEqual([12, 21]);
    expect(findWord('A prototyped idea.', 'type')).toBeNull();
  });

  it('falls back to another form of the word', () => {
    expect(findWord('The team collaborated for months.', 'collaborate')).toEqual([9, 21]);
  });

  it('prefers the exact form over an earlier inflection', () => {
    const text = 'She noticed it. Then notice this.';
    expect(findWord(text, 'notice')).toEqual([21, 27]);
  });

  it('keeps a possessive with its word', () => {
    expect(findWord('The keeper’s lamp.', 'keeper')).toEqual([4, 12]);
  });

  it('matches multi-word items across any whitespace', () => {
    expect(findWord('They know it by  heart now.', 'by heart')).toEqual([13, 22]);
    expect(findWord('Nearby heartland.', 'by heart')).toBeNull();
  });
});

describe('segmentLevel', () => {
  const paragraphs = [
    'Their first prototype was made of cardboard, a bike torch and a lot of arguing.',
    'The team learned to collaborate: Priya wrote the story. “Narrative matters,” she says. Another prototype followed.',
  ];

  it('makes the first occurrence of each word a tap word and keeps the text intact', () => {
    const segments = segmentLevel(paragraphs, ['prototype', 'collaborate', 'narrative']);
    expect(segments.map(joined)).toEqual(paragraphs);
    expect(words(segments[0]).map((w) => w.kind === 'word' && w.key)).toEqual(['prototype']);
    // The second "prototype" stays plain text.
    expect(words(segments[1]).map((w) => w.kind === 'word' && w.key)).toEqual(['collaborate', 'narrative']);
  });

  it('keeps trailing and opening punctuation with the word', () => {
    const [, second] = segmentLevel(paragraphs, ['collaborate', 'narrative']);
    const [collab, narrative] = words(second);
    expect(collab).toMatchObject({ text: 'collaborate', trailing: ':', leading: '' });
    expect(narrative).toMatchObject({ text: 'Narrative', leading: '“', trailing: '' });
  });

  it('does not treat an apostrophe inside a word as opening punctuation', () => {
    const [segs] = segmentLevel(["It's a rare find, isn't it?"], ['rare']);
    expect(words(segs)[0]).toMatchObject({ text: 'rare', leading: '', trailing: '' });
  });

  it('prefers the longer item when two overlap', () => {
    const [segs] = segmentLevel(['They learned it by heart.'], ['heart', 'by heart']);
    expect(words(segs).map((w) => w.kind === 'word' && w.key)).toEqual(['by heart']);
  });

  it('ignores words that are not in the text', () => {
    const [segs] = segmentLevel(['Nothing here.'], ['describes']);
    expect(segs).toEqual([{ kind: 'text', text: 'Nothing here.' }]);
  });
});

describe('sentences', () => {
  it('finds the sentence around an index', () => {
    const text = 'It started as a project. Their first prototype was cardboard. Then it grew.';
    expect(sentenceAround(text, text.indexOf('prototype'))).toBe('Their first prototype was cardboard.');
    expect(firstSentenceWith([text], 'prototype')).toBe('Their first prototype was cardboard.');
  });

  it('keeps closing quotes with the sentence', () => {
    const text = '“The narrative matters more,” Priya says. “You keep playing.”';
    expect(sentenceAround(text, 5)).toBe('“The narrative matters more,” Priya says.');
  });

  it('shortens long sentences around the word', () => {
    const text = `${Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ')} target ${Array.from({ length: 40 }, (_, i) => `x${i}`).join(' ')}.`;
    const out = sentenceAround(text, text.indexOf('target'), 10);
    expect(out.startsWith('…')).toBe(true);
    expect(out.endsWith('…')).toBe(true);
    expect(out).toContain('target');
    expect(out.replace(/…/g, '').split(' ')).toHaveLength(10);
  });
});

describe('wordBoundsAt and lookupKey', () => {
  it('finds the word under an index, keeping inner apostrophes', () => {
    const text = 'The keeper’s lamp, don’t you think?';
    expect(text.slice(...(wordBoundsAt(text, 6) as [number, number]))).toBe('keeper’s');
    expect(text.slice(...(wordBoundsAt(text, 21) as [number, number]))).toBe('don’t');
    // Right after the last letter still counts.
    expect(text.slice(...(wordBoundsAt(text, 17) as [number, number]))).toBe('lamp');
    expect(wordBoundsAt(text, 18)).toBeNull();
    expect(wordBoundsAt('Year 2026 ends', 6)).toBeNull();
  });

  it('turns a tapped word into a lookup key', () => {
    expect(lookupKey('Keeper’s')).toBe('keeper');
    expect(lookupKey("'Hello'")).toBe('hello');
  });
});

describe('quiz evidence', () => {
  const paragraphs = [
    'Was the ball in or out? Many decisions are made with help from Hawk-Eye.',
    'A computer combines their views to work out exactly where the ball is and to track its path.',
  ];

  it('lists quoted passages, longest first', () => {
    expect(quotedPassages('The story says “a b c” and "d e".')).toEqual(['a b c', 'd e']);
  });

  it('finds a quoted passage ignoring case, quote style and trailing punctuation', () => {
    const explanation = 'The story says “a computer combines their views to work out exactly where the ball is.”';
    expect(findEvidence(explanation, paragraphs)).toEqual({ para: 1, start: 0, end: 69 });
  });

  it('tries shorter prefixes when the end is paraphrased', () => {
    expect(findPassage(paragraphs[1], 'A computer combines their views, then decides')).toEqual([0, 25]);
  });

  it('returns null when nothing quoted is in the story', () => {
    expect(findEvidence('"Dolphins win the game" matches the story.', paragraphs)).toBeNull();
    expect(findEvidence('No quotes at all.', paragraphs)).toBeNull();
  });
});
