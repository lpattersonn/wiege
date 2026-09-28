import { describe, expect, it } from 'vitest';

import { countWords } from '@/lib/progress/text';

import { computeWritingStats, findUsedVocabulary, heuristicFeedback, quoteStart, type FeedbackInput } from './feedback-core';
import { WritingFeedback, writingFeedbackProblems } from './types';

const base: Omit<FeedbackInput, 'text'> = {
  prompt: 'Summarise the story for a friend who has not read it.',
  gradeBand: '7-8',
  vocabulary: ['resilient', 'reveal', 'significant'],
};

function feedback(text: string, extra: Partial<FeedbackInput> = {}) {
  return heuristicFeedback({ ...base, text, ...extra });
}

function expectValid(result: WritingFeedback) {
  expect(WritingFeedback.safeParse(result).success).toBe(true);
  expect(writingFeedbackProblems(result)).toEqual([]);
  for (const line of [...result.glow, ...result.grow, result.nextStep]) {
    expect(line.trim().length).toBeGreaterThan(10);
    expect(line).not.toMatch(/undefined|NaN|\[object/);
  }
  expect(new Set(result.glow).size).toBe(2);
  expect(new Set(result.grow).size).toBe(2);
}

describe('computeWritingStats', () => {
  it('counts words the same way as the journal', () => {
    const text = "Don't stop — the well-known team's 3 wins were remarkable!";
    expect(computeWritingStats(text).words).toBe(countWords(text));
  });

  it('computes sentences, averages, unique ratio and long words', () => {
    expect(computeWritingStats('The team trained hard. The team won the championship!')).toEqual({
      words: 9,
      sentences: 2,
      avgSentenceLength: 4.5,
      uniqueWordRatio: 0.67,
      longWords: 2,
    });
    expect(computeWritingStats('')).toEqual({ words: 0, sentences: 0, avgSentenceLength: 0, uniqueWordRatio: 0, longWords: 0 });
  });
});

describe('findUsedVocabulary', () => {
  it('matches other forms of a word, keeps the given order and spelling, and skips duplicates', () => {
    const text = 'The results revealed a significantly bigger crowd. Resilient fans stayed.';
    expect(findUsedVocabulary(text, ['significant', 'Reveal', 'resilient', 'reveal', 'abandon'])).toEqual([
      'significant',
      'Reveal',
      'resilient',
    ]);
  });

  it('handles inflections such as -ies, doubled consonants and -ing', () => {
    expect(findUsedVocabulary('Scientists made several discoveries.', ['discovery'])).toEqual(['discovery']);
    expect(findUsedVocabulary('She committed to the plan.', ['commit'])).toEqual(['commit']);
    expect(findUsedVocabulary('They were achieving more each week.', ['achieve'])).toEqual(['achieve']);
  });

  it('matches multi-word items only as a phrase', () => {
    expect(findUsedVocabulary('We will take part tomorrow.', ['take part'])).toEqual(['take part']);
    expect(findUsedVocabulary('Take the other part.', ['take part'])).toEqual([]);
  });

  it('does not match unrelated words', () => {
    expect(findUsedVocabulary('The notes were short.', ['notice'])).toEqual([]);
  });
});

describe('quoteStart', () => {
  it('quotes the student exactly and marks truncation', () => {
    expect(quoteStart('One two three.', 5)).toBe('One two three.');
    expect(quoteStart('One, two, three, four, five, six', 3)).toBe('One, two, three…');
    expect(quoteStart('  Spaced   out   words  ', 10)).toBe('Spaced out words');
  });
});

describe('heuristicFeedback', () => {
  it('praises vocabulary use and specific details by quoting the student', () => {
    const text =
      'The story reveals how a small club in Leeds won 3 matches in a row. The players were resilient because they practised every morning. ' +
      'Their coach said the win was significant for the whole town. I think other teams could learn from them.';
    const result = feedback(text, { minWords: 40, maxWords: 90 });
    expectValid(result);
    expect(result.usedVocabulary).toEqual(['resilient', 'reveal', 'significant']);
    expect(result.glow[0]).toMatch(/"reveals"|"resilient"/);
    expect(result.glow.join(' ')).toMatch(/"[^"]+"/);
    expect(result.rubric.ideas).toBeGreaterThanOrEqual(3);
    expect(result.rubric.conventions).toBe(4);
  });

  it('asks for more when the writing is below the target', () => {
    const result = feedback('The team won the cup after a long season of hard work.', { minWords: 60 });
    expectValid(result);
    expect(result.grow[0]).toMatch(/aim for at least 60/);
    expect(result.nextStep).toMatch(/^Add two sentences/);
    expect(result.rubric.ideas).toBeLessThanOrEqual(2);
  });

  it('spots missing capitals, a lower-case "i" and missing end punctuation', () => {
    const text = 'the match was fun and i liked it. we cheered for the team. then we went home and ate some food';
    const result = feedback(text, { minWords: 10 });
    expectValid(result);
    const grows = result.grow.join(' ');
    expect(grows).toMatch(/full stop|capital letter/);
    expect(result.rubric.conventions).toBeLessThanOrEqual(2);
  });

  it('points at a run-on sentence by quoting its start', () => {
    const text =
      'We went to the museum and we saw the old paintings and then we had lunch and then we saw the statues and then we went to the shop and bought postcards and then we got the bus home and it was late.';
    const result = feedback(text, { minWords: 20 });
    expectValid(result);
    expect(result.grow.join(' ')).toMatch(/Your sentence starting "We went to the museum and…" runs for \d+ words/);
  });

  it('flags vague and repeated words', () => {
    const text =
      'The game was really good. The game had really nice music. The levels were really big and the game was good fun. The game is a good thing to play.';
    const result = feedback(text, { minWords: 20 });
    expectValid(result);
    expect(result.grow.join(' ')).toMatch(/"really"|"good"|"game"/);
    expect(result.rubric.wordChoice).toBeLessThanOrEqual(2);
  });

  it('asks for a reason when an opinion has none', () => {
    const text = 'I think the new stadium is a great idea. Everyone will like it. It will be fun to go there with friends.';
    const result = feedback(text, { prompt: 'Should the town build a new stadium? Give your opinion.', minWords: 15, promptKind: 'opinion' });
    expectValid(result);
    expect(result.grow.join(' ')).toMatch(/because/);
  });

  it('warns when the writing is over the maximum', () => {
    const text = Array.from({ length: 12 }, (_, i) => `Sentence number ${i + 1} adds another careful idea about the match.`).join(' ');
    const result = feedback(text, { minWords: 20, maxWords: 50 });
    expectValid(result);
    expect(result.grow.join(' ') + result.nextStep).toMatch(/at most 50|repeats/);
  });

  it('gives a gentle start for empty or tiny texts', () => {
    for (const text of ['', '   ', 'Hi', 'The team won']) {
      const result = feedback(text);
      expectValid(result);
      expect(result.rubric).toEqual({ ideas: 1, organization: 1, wordChoice: 1, conventions: 1 });
    }
    expect(feedback('The team won').glow[0]).toContain('"The team won"');
  });

  it('is deterministic', () => {
    const text = 'The festival returns in May. Artists from 20 countries will paint murals. Visitors can watch them work.';
    expect(feedback(text)).toEqual(feedback(text));
  });

  it('never uses praise or advice that is not grounded in the text', () => {
    const result = feedback('Birds fly south. They come back in spring. The trip is long. They rest on the way.', { minWords: 10 });
    expectValid(result);
    for (const glow of result.glow) {
      const quoted = /"([^"]+)"/.exec(glow)?.[1];
      if (quoted) {
        const plain = quoted.replace(/^…|…$/g, '');
        expect('Birds fly south. They come back in spring. The trip is long. They rest on the way.').toContain(plain);
      }
    }
  });
});

// Deterministic pseudo-random generator for property tests.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAGMENTS = [
  'the team', 'Der Künstler', 'naïve café', 'résumé', '東京の美術館', 'Ωμέγα', '😀😀', 'really really', 'i', "don't",
  'well-known', '3.5', '2026', '!!!', '...', '?!', '—', '"quoted words"', '(brackets)', 'revealed', 'resilience',
  'significantly', 'Mr.', 'e.g.', 'U.S.', '\n', '\n\n', '\t', ',,,', ';', 'constructor', '__proto__', 'toString',
  'hasOwnProperty', 'ALL CAPS SHOUTING', 'a', 'an', 'because', 'however', 'for example', 'Leeds', 'NASA', "o'clock",
];

function randomText(random: () => number): string {
  const length = Math.floor(random() * 120);
  const parts: string[] = [];
  for (let i = 0; i < length; i++) {
    parts.push(FRAGMENTS[Math.floor(random() * FRAGMENTS.length)]);
    const r = random();
    if (r < 0.15) parts.push('.');
    else if (r < 0.2) parts.push('?');
  }
  return parts.join(random() < 0.5 ? ' ' : '');
}

describe('heuristicFeedback properties', () => {
  it('is always schema-valid, complete and within 1–4 for varied, messy input', () => {
    const random = mulberry32(20260927);
    for (let i = 0; i < 400; i++) {
      const text = randomText(random);
      const input: FeedbackInput = {
        prompt: random() < 0.5 ? 'Give your opinion: should games have level editors?' : '',
        text,
        gradeBand: random() < 0.5 ? '7-8' : '9-10',
        vocabulary: random() < 0.3 ? [] : ['resilient', 'reveal', 'take part', 'constructor', ''],
        minWords: random() < 0.5 ? undefined : Math.floor(random() * 200),
        maxWords: random() < 0.5 ? undefined : Math.floor(random() * 300),
        promptKind: random() < 0.3 ? 'opinion' : undefined,
      };
      const result = heuristicFeedback(input);
      expectValid(result);
      expect(result.stats.words).toBe(countWords(text));
      expect(heuristicFeedback(input)).toEqual(result);
    }
  });

  it('handles very long text quickly', () => {
    const text = 'The runners crossed the finish line together because they had trained as a team. '.repeat(400);
    const started = performance.now();
    const result = feedback(text);
    expect(performance.now() - started).toBeLessThan(500);
    expectValid(result);
    expect(result.grow.join(' ')).toMatch(/paragraphs|repeated|times/);
  });
});
