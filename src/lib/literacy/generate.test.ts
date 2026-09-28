import { beforeEach, describe, expect, it, vi } from 'vitest';

import { heuristicLesson } from './heuristic';
import { LessonContent, lessonContentProblems } from './types';

const mocks = vi.hoisted(() => ({ available: { value: true }, claudeLesson: vi.fn() }));

vi.mock('@/lib/ai/client', () => ({ aiAvailable: () => mocks.available.value }));
vi.mock('./claude', () => ({ claudeLesson: mocks.claudeLesson }));

const { generateLesson, normalizeLesson } = await import('./generate');

const input = {
  title: 'Young chess player wins national title',
  excerpt:
    'A 13-year-old won the national chess championship after a week of games. Her coach said her strategy was remarkable and her patience was significant.',
  category: 'games' as const,
  sourceName: 'Example News',
  url: 'https://example.com/chess',
};

/** A complete lesson standing in for Claude output. */
const modelLesson: LessonContent = heuristicLesson({ ...input, url: 'https://example.com/model' });

beforeEach(() => {
  mocks.available.value = true;
  mocks.claudeLesson.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('generateLesson', () => {
  it('uses the heuristic engine when AI is not configured', async () => {
    mocks.available.value = false;
    const result = await generateLesson(input, { siblingTitles: ['Other story headline here'] });
    expect(result.generator).toBe('heuristic');
    expect(result.model).toBeNull();
    expect(lessonContentProblems(result.content)).toEqual([]);
    expect(result.readingGrade).toBeGreaterThan(0);
    expect(mocks.claudeLesson).not.toHaveBeenCalled();
  });

  it('uses Claude output when it is complete and safe', async () => {
    mocks.claudeLesson.mockResolvedValueOnce({ ok: true, value: modelLesson, model: 'claude-opus-5' });
    const result = await generateLesson({ ...input, fullText: 'Longer article text.' }, { timeoutMs: 15_000 });
    expect(result).toMatchObject({ generator: 'claude', model: 'claude-opus-5' });
    expect(mocks.claudeLesson).toHaveBeenCalledWith(
      { title: input.title, excerpt: input.excerpt, fullText: 'Longer article text.', category: 'games', sourceName: 'Example News' },
      { timeoutMs: 15_000 },
    );
    expect(lessonContentProblems(result.content)).toEqual([]);
  });

  it('falls back to the heuristic lesson when Claude fails', async () => {
    mocks.claudeLesson.mockResolvedValueOnce({ ok: false, reason: 'refusal', detail: 'x' });
    expect((await generateLesson(input)).generator).toBe('heuristic');
  });

  it('falls back when the generated text fails the kid-safety re-scan', async () => {
    const unsafe: LessonContent = {
      ...modelLesson,
      levels: { ...modelLesson.levels, '7-8': { ...modelLesson.levels['7-8'], paragraphs: ['The rivals planned a murder.'] } },
    };
    mocks.claudeLesson.mockResolvedValueOnce({ ok: true, value: unsafe, model: 'claude-opus-5' });
    const result = await generateLesson(input);
    expect(result.generator).toBe('heuristic');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('safety re-scan'));
  });

  it('never rejects because of an AI problem', async () => {
    mocks.claudeLesson.mockResolvedValueOnce({ ok: false, reason: 'connection', detail: 'offline' });
    await expect(generateLesson(input)).resolves.toMatchObject({ generator: 'heuristic' });
  });
});

describe('normalizeLesson', () => {
  it('tidies text, ids, word ranges and vocabulary bands, keeping every answer correct', () => {
    const messy: LessonContent = {
      ...modelLesson,
      keyIdea: '  A   key idea. ',
      levels: {
        '7-8': { title: 'Title one.', paragraphs: ['  First   paragraph with strategy. ', '', 'Second.'] },
        '9-10': { title: 'Title two', paragraphs: ['Only here: remarkable and strategy.'] },
      },
      vocabulary: [
        { word: 'strategy', partOfSpeech: 'Noun', definition: 'A plan', example: 'Ex.', band: '9-10' },
        { word: 'Strategy', partOfSpeech: 'noun', definition: 'Duplicate', example: 'Ex.', band: 'both' },
        { word: 'remarkable', partOfSpeech: 'adjective', definition: 'Worth noticing', example: 'Ex.', band: 'both' },
        { word: 'absent', partOfSpeech: 'adjective', definition: 'Not there', example: 'Ex.', band: 'both' },
      ],
      quiz: modelLesson.quiz.map((q) => ({ ...q, id: 'same', answerIndex: 0 })),
      writingPrompts: modelLesson.writingPrompts.map((p) => ({ ...p, id: 'x', minWords: 40.4, maxWords: 20 })),
    };
    const clean = normalizeLesson(messy, 'seed');
    expect(clean.keyIdea).toBe('A key idea.');
    expect(clean.levels['7-8']).toEqual({ title: 'Title one', paragraphs: ['First paragraph with strategy.', 'Second.'] });
    expect(clean.quiz.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5']);
    clean.quiz.forEach((q, i) => expect(q.choices[q.answerIndex]).toBe(messy.quiz[i].choices[0]));
    expect(new Set(clean.quiz.map((q) => q.answerIndex)).size).toBeGreaterThan(1);
    expect(clean.writingPrompts.map((p) => [p.id, p.minWords, p.maxWords])).toEqual([
      ['p1', 40, 40],
      ['p2', 40, 40],
      ['p3', 40, 40],
    ]);
    // Too few words are left after dropping "absent", so the model's list is kept, with corrected bands.
    expect(clean.vocabulary.map((v) => [v.word, v.band])).toEqual([
      ['strategy', 'both'],
      ['remarkable', '9-10'],
      ['absent', 'both'],
    ]);
    expect(clean.vocabulary[0].partOfSpeech).toBe('noun');
  });

  it('is deterministic', () => {
    expect(normalizeLesson(modelLesson, 'a')).toEqual(normalizeLesson(modelLesson, 'a'));
  });
});
