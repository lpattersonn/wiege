import { describe, expect, it } from 'vitest';

import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/categories';
import { scanLesson } from '@/lib/news/safety';

import { cleanExcerpt, cleanTitle, heuristicLesson, splitLongSentence, type HeuristicSourceInput } from './heuristic';
import { levelText } from './readability';
import { LessonContent, lessonContentProblems } from './types';
import { containsWord } from './word-forms';

const story: HeuristicSourceInput = {
  title: 'Teenage chess player becomes youngest grandmaster in the country - BBC Newsround',
  excerpt:
    'A 14-year-old from Leeds has become the youngest chess grandmaster in the UK after a tournament in Spain that lasted nine days. ' +
    'She said the achievement was the result of years of practice, and her coach described her strategy as remarkable and innovative. ' +
    'The English Chess Federation will celebrate her success at an event in London next month.',
  category: 'games',
  sourceName: 'BBC Newsround',
  url: 'https://www.bbc.co.uk/newsround/example',
};

function expectComplete(lesson: LessonContent) {
  expect(LessonContent.safeParse(lesson).success).toBe(true);
  expect(lessonContentProblems(lesson)).toEqual([]);
  const junior = levelText(lesson.levels['7-8']);
  const senior = levelText(lesson.levels['9-10']);
  for (const item of lesson.vocabulary) {
    if (item.band !== '9-10') expect(containsWord(junior, item.word), `${item.word} in 7-8`).toBe(true);
    if (item.band !== '7-8') expect(containsWord(senior, item.word), `${item.word} in 9-10`).toBe(true);
    expect(item.definition.length).toBeGreaterThan(5);
    expect(item.example.length).toBeGreaterThan(5);
  }
  for (const question of lesson.quiz) {
    expect(new Set(question.choices.map((c) => c.toLowerCase())).size).toBe(4);
    expect(question.choices.every((c) => c.trim().length > 0)).toBe(true);
    expect(question.explanation.length).toBeGreaterThan(10);
  }
  expect(new Set(lesson.quiz.map((q) => q.id)).size).toBe(5);
  expect(new Set(lesson.writingPrompts.map((p) => p.kind)).size).toBe(3);
  expect(lesson.keyIdea.trim().length).toBeGreaterThan(0);
}

describe('cleaning', () => {
  it('removes the source suffix and final full stop from titles', () => {
    expect(cleanTitle('Big win for city club - BBC Sport', 'BBC Sport')).toBe('Big win for city club');
    expect(cleanTitle('Museum opens | The Guardian', 'The Guardian')).toBe('Museum opens');
    expect(cleanTitle('A headline.', 'X')).toBe('A headline');
    expect(cleanTitle('   ', 'X')).toBe('A story from the news');
    expect(cleanTitle('x'.repeat(200), '').length).toBeLessThanOrEqual(121);
  });

  it('strips feed boilerplate, links and a sentence cut off mid-way', () => {
    expect(cleanExcerpt('The club won. The post Big win appeared first on Sports Site.')).toBe('The club won.');
    expect(cleanExcerpt('Read this. See https://example.com/x for more. Continue reading…')).toBe('Read this. See for more.');
    expect(cleanExcerpt('First sentence here. Second one was cut off in the mid…')).toBe('First sentence here.');
    expect(cleanExcerpt('Only a fragment that was cut...')).toBe('Only a fragment that was cut…');
  });

  it('splits long sentences at a central clause boundary for Grade 7–8', () => {
    const long =
      'The museum opened a new gallery for young visitors on Saturday morning, and hundreds of families queued outside to see the giant painted animals.';
    const parts = splitLongSentence(long);
    expect(parts).toEqual([
      'The museum opened a new gallery for young visitors on Saturday morning.',
      'Hundreds of families queued outside to see the giant painted animals.',
    ]);
    expect(splitLongSentence('Short sentence stays whole.')).toEqual(['Short sentence stays whole.']);
    expect(splitLongSentence('"Quoted speech, and more words that go on and on, is never split by the tool at all," she said today.')).toHaveLength(1);
  });
});

describe('heuristicLesson', () => {
  it('builds a complete lesson from the title and excerpt', () => {
    const lesson = heuristicLesson(story, { siblingTitles: ['New Mario game announced', 'Museum opens dinosaur hall', 'Swimmer sets record'] });
    expectComplete(lesson);
    expect(lesson.levels['7-8'].title).toBe('Teenage chess player becomes youngest grandmaster in the country');
    expect(lesson.vocabulary.map((v) => v.word)).toEqual(expect.arrayContaining(['strategy', 'remarkable', 'innovative']));
    expect(lesson.quiz.map((q) => q.skill)).toEqual(['main-idea', 'detail', 'vocabulary', 'purpose', 'sequence']);
    expect(lesson.quiz[0].choices).toEqual(expect.arrayContaining(['New Mario game announced', 'Museum opens dinosaur hall']));
    expect(lesson.writingPrompts[0].kind).toBe('summary');
    expect(scanLesson(lesson).safe).toBe(true);
  });

  it('is deterministic for the same story and varies answer positions across stories', () => {
    expect(heuristicLesson(story)).toEqual(heuristicLesson(story));
    const positions = new Set<number>();
    for (let i = 0; i < 12; i++) {
      for (const q of heuristicLesson({ ...story, url: `https://example.com/${i}` }).quiz) positions.add(q.answerIndex);
    }
    expect(positions.size).toBe(4);
  });

  it('uses the story text in the cloze question and blanks exactly one word', () => {
    const cloze = heuristicLesson(story).quiz[1];
    expect(cloze.question).toMatch(/_____/);
    expect(cloze.explanation).toContain('The story says');
    const answer = cloze.choices[cloze.answerIndex];
    expect(cloze.question.replace('_____', answer)).toContain(cloze.explanation.replace(/^The story says: "|"$/g, ''));
  });

  it('always has at least five vocabulary words, even for a one-line excerpt', () => {
    for (const category of CATEGORY_SLUGS) {
      const lesson = heuristicLesson({ ...story, category, excerpt: 'Fans cheered.', title: 'Cheers' });
      expectComplete(lesson);
      expect(lesson.vocabulary.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('teaches a long, less common word from the story when there are few list words', () => {
    const lesson = heuristicLesson({
      ...story,
      excerpt: 'The archaeologists uncovered beautifully decorated pottery near the lighthouse yesterday afternoon.',
      title: 'Pottery found near lighthouse',
    });
    expectComplete(lesson);
    expect(lesson.vocabulary.map((v) => v.word)).toContain('archaeologists');
  });

  it('does not teach long forms of everyday words ("bringing", "floating")', () => {
    const lesson = heuristicLesson({
      ...story,
      title: 'Floating library visits islands',
      excerpt: 'A floating library is bringing books directly to children across the islands of Kagawa Prefecture this summer.',
    });
    expectComplete(lesson);
    const words = lesson.vocabulary.map((v) => v.word);
    expect(words).not.toContain('floating');
    expect(words).not.toContain('bringing');
  });
});

// Deterministic pseudo-random generator for property tests.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIECES = [
  'The team', 'won', 'Der Künstler malte', 'café', '東京の美術館で', 'Ωμέγα', '😀', '3', '2,500', '12.5', '—', '…', '...',
  '"quoted"', '(aside)', 'remarkable', 'significant', 'strategy', 'Leeds', 'NASA', "o'clock", 'well-known', '!!!', '?',
  ';', ',', 'and', 'but', 'so', 'because', 'the museum', 'players', 'constructor', '__proto__', '<b>tag</b>', '&amp;',
  'https://example.com', 'Read more', '\n', 'x', 'I', 'a', 'eventually', 'the new level',
];

function randomText(random: () => number, maxPieces: number): string {
  const count = Math.floor(random() * maxPieces);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    parts.push(PIECES[Math.floor(random() * PIECES.length)]);
    if (random() < 0.12) parts.push('.');
  }
  return parts.join(random() < 0.8 ? ' ' : '');
}

describe('heuristicLesson properties', () => {
  it('is always complete, schema-valid and deterministic for varied, messy input', () => {
    const random = mulberry32(42);
    for (let i = 0; i < 300; i++) {
      const input: HeuristicSourceInput = {
        title: randomText(random, 14),
        excerpt: randomText(random, 110),
        category: CATEGORY_SLUGS[Math.floor(random() * 4)] as CategorySlug,
        sourceName: random() < 0.1 ? '' : randomText(random, 3) || 'Source',
        url: `https://example.com/story/${i}`,
      };
      const siblings = Array.from({ length: Math.floor(random() * 5) }, () => randomText(random, 10));
      const lesson = heuristicLesson(input, { siblingTitles: siblings });
      expectComplete(lesson);
      expect(heuristicLesson(input, { siblingTitles: siblings })).toEqual(lesson);
    }
  });
});
