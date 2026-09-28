import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { describe, expect, it } from 'vitest';

import { getLandingDemoStory } from './samples';
import { LessonContent, lessonContentProblems, WritingFeedback, writingFeedbackProblems, type LessonContent as Lesson } from './types';

const complete: Lesson = {
  keyIdea: 'k',
  levels: { '7-8': { title: 't', paragraphs: ['p'] }, '9-10': { title: 't', paragraphs: ['p'] } },
  vocabulary: Array.from({ length: 5 }, (_, i) => ({ word: `w${i}`, partOfSpeech: 'noun', definition: 'd', example: 'e', band: 'both' as const })),
  quiz: Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, skill: 'detail' as const, question: 'q', choices: ['a', 'b', 'c', 'd'], answerIndex: i % 4, explanation: 'x' })),
  writingPrompts: Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, kind: 'summary' as const, prompt: 'p', minWords: 40, maxWords: 90, tips: [] })),
  discussion: ['a', 'b'],
};

describe('literacy schemas', () => {
  it('convert to Claude structured-output schemas: closed objects, no numeric bounds', () => {
    for (const schema of [LessonContent, WritingFeedback]) {
      const text = JSON.stringify(betaZodOutputFormat(schema).schema);
      expect(text).not.toMatch(/minimum|maximum|"additionalProperties":true|"minItems":[2-9]/);
      expect(text).toContain('"additionalProperties":false');
    }
  });

  it('flag the counts and ranges the output schema cannot enforce', () => {
    expect(lessonContentProblems(complete)).toEqual([]);
    const broken: Lesson = {
      ...complete,
      quiz: complete.quiz.slice(0, 4).map((q, i) => (i === 0 ? { ...q, answerIndex: 4 } : i === 1 ? { ...q, choices: ['a'] } : q)),
      writingPrompts: [{ ...complete.writingPrompts[0], minWords: 50.5 }],
      discussion: [],
      vocabulary: [],
    };
    expect(lessonContentProblems(broken)).toEqual([
      'vocabulary has 0 words (expected 5 to 8)',
      'quiz has 4 questions (expected 5)',
      'quiz[0].answerIndex 4 is out of range',
      'quiz[1] has 1 choices (expected 4)',
      'quiz[1].answerIndex 1 is out of range',
      'writingPrompts has 1 prompts (expected 3)',
      'writingPrompts[0] has an invalid word range',
      'discussion has 0 questions (expected 2)',
    ]);
  });

  it('checks feedback rubric scores and list lengths', () => {
    const feedback = {
      glow: ['a', 'b'],
      grow: ['c', 'd'],
      nextStep: 'n',
      rubric: { ideas: 1, organization: 4, wordChoice: 2, conventions: 3 },
      usedVocabulary: [],
      stats: { words: 1, sentences: 1, avgSentenceLength: 1, uniqueWordRatio: 1, longWords: 0 },
      generator: 'claude' as const,
    };
    expect(WritingFeedback.parse(feedback)).toEqual(feedback);
    expect(writingFeedbackProblems(feedback)).toEqual([]);
    expect(writingFeedbackProblems({ ...feedback, glow: ['a'], rubric: { ...feedback.rubric, ideas: 5, conventions: 2.5 } })).toHaveLength(3);
  });

  it('closed objects reject unknown enum values', () => {
    expect(LessonContent.safeParse({ ...complete, quiz: [{ ...complete.quiz[0], skill: 'guessing' }] }).success).toBe(false);
  });

  it('the landing demo story is schema-valid', () => {
    expect(LessonContent.safeParse(getLandingDemoStory().content).success).toBe(true);
  });
});
