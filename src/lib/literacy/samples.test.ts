import { describe, expect, it } from 'vitest';

import { CATEGORY_SLUGS } from '@/lib/categories';
import { scanLesson } from '@/lib/news/safety';
import { countWords } from '@/lib/progress/text';

import { fleschKincaidGrade, levelText, textStatistics } from './readability';
import { getLandingDemoStory, PRACTICE_STORIES } from './samples';
import { GRADE_BANDS, LessonContent, lessonContentProblems } from './types';
import { containsWord } from './word-forms';

const RANGES = { '7-8': [180, 260], '9-10': [240, 340] } as const;
const WORD_RANGES = { summary: [40, 90], headline: [15, 60], opinion: [60, 150], creative: [80, 200], letter: [60, 150] } as const;

describe('practice stories', () => {
  it('are twelve, three per category, with unique practice slugs and fixed dates', () => {
    expect(PRACTICE_STORIES).toHaveLength(12);
    for (const category of CATEGORY_SLUGS) expect(PRACTICE_STORIES.filter((s) => s.category === category)).toHaveLength(3);
    expect(new Set(PRACTICE_STORIES.map((s) => s.slug)).size).toBe(12);
    for (const story of PRACTICE_STORIES) {
      expect(story.slug).toMatch(/^practice-[a-z0-9-]+$/);
      expect(Number.isNaN(Date.parse(story.publishedAt))).toBe(false);
      expect(story.excerpt.length).toBeLessThanOrEqual(600);
      expect(story.title).toBe(story.content.levels['7-8'].title);
    }
  });

  for (const story of PRACTICE_STORIES) {
    describe(story.slug, () => {
      const { content } = story;

      it('is a complete, schema-valid lesson that passes the kid-safety scan', () => {
        expect(LessonContent.safeParse(content).success).toBe(true);
        expect(lessonContentProblems(content)).toEqual([]);
        expect(scanLesson(content).reasons).toEqual([]);
        expect(countWords(content.keyIdea)).toBeLessThanOrEqual(30);
      });

      it('has two genuinely different reading levels within the word ranges', () => {
        for (const band of GRADE_BANDS) {
          const words = countWords(levelText(content.levels[band]));
          expect(words, `${band} has ${words} words`).toBeGreaterThanOrEqual(RANGES[band][0]);
          expect(words, `${band} has ${words} words`).toBeLessThanOrEqual(RANGES[band][1]);
          expect(content.levels[band].paragraphs.length).toBeGreaterThanOrEqual(3);
          expect(content.levels[band].title).not.toMatch(/\.$/);
        }
        const junior = textStatistics(levelText(content.levels['7-8']));
        const senior = textStatistics(levelText(content.levels['9-10']));
        expect(senior.avgSentenceLength).toBeGreaterThan(junior.avgSentenceLength);
        expect(fleschKincaidGrade(levelText(content.levels['9-10']))).toBeGreaterThan(fleschKincaidGrade(levelText(content.levels['7-8'])));
        expect(fleschKincaidGrade(levelText(content.levels['7-8']))).toBeLessThanOrEqual(10);
      });

      it('lists vocabulary exactly where it appears', () => {
        const texts = { '7-8': levelText(content.levels['7-8']), '9-10': levelText(content.levels['9-10']) };
        for (const item of content.vocabulary) {
          const inJunior = containsWord(texts['7-8'], item.word);
          const inSenior = containsWord(texts['9-10'], item.word);
          const expected = inJunior && inSenior ? 'both' : inJunior ? '7-8' : inSenior ? '9-10' : 'missing';
          expect(item.band, item.word).toBe(expected);
          expect(containsWord(item.definition, item.word), `${item.word} definition uses the word`).toBe(false);
          expect(containsWord(texts['7-8'], item.example) || containsWord(texts['9-10'], item.example)).toBe(false);
        }
        expect(content.vocabulary.filter((v) => v.band !== '9-10').length).toBeGreaterThanOrEqual(4);
        expect(new Set(content.vocabulary.map((v) => v.word)).size).toBe(content.vocabulary.length);
      });

      it('has a quiz covering the five skills with varied answer positions and distinct choices', () => {
        expect(content.quiz.map((q) => q.skill).slice(0, 4)).toEqual(['main-idea', 'detail', 'inference', 'vocabulary']);
        expect(['purpose', 'sequence']).toContain(content.quiz[4].skill);
        expect(new Set(content.quiz.map((q) => q.answerIndex)).size).toBeGreaterThanOrEqual(3);
        for (const question of content.quiz) {
          expect(new Set(question.choices).size).toBe(4);
          expect(question.explanation).not.toMatch(/\b(?:option|choice) [A-D]\b|\b[A-D]\)/);
        }
      });

      it('has three different writing prompts, one a summary, with realistic word ranges', () => {
        expect(content.writingPrompts.map((p) => p.kind)).toContain('summary');
        expect(new Set(content.writingPrompts.map((p) => p.kind)).size).toBe(3);
        for (const prompt of content.writingPrompts) {
          const [min, max] = WORD_RANGES[prompt.kind];
          expect(prompt.minWords).toBeGreaterThanOrEqual(min);
          expect(prompt.maxWords).toBeLessThanOrEqual(max);
          expect(prompt.tips.length).toBeGreaterThanOrEqual(2);
        }
        expect(content.discussion).toHaveLength(2);
      });
    });
  }

  it('the landing demo is a practice story, available without a database', () => {
    const demo = getLandingDemoStory();
    expect(demo.slug).toBe('practice-libraries-lend-more');
    expect(PRACTICE_STORIES.some((s) => s.slug === demo.slug && s.content === demo.content)).toBe(true);
  });
});
