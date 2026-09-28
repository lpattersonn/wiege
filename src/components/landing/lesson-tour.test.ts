import { describe, expect, it } from 'vitest';

import { getLandingDemoStory, PRACTICE_STORIES } from '@/lib/literacy/samples';

import { buildLessonTour, EXAMPLE_DRAFTS, firstQuote, markDraft } from './lesson-tour';

const draftText = (parts: ReturnType<typeof markDraft>) => parts.map((p) => (p.kind === 'caret' ? '^' : p.text)).join('');

describe('buildLessonTour', () => {
  const story = getLandingDemoStory();
  const tour = buildLessonTour(story);

  it('shows both reading levels with their real sizes', () => {
    expect(tour.levels.map((l) => l.label)).toEqual(['Grade 7–8', 'Grade 9–10']);
    expect(tour.levels[0].title).toBe(story.content.levels['7-8'].title);
    expect(tour.levels[1].title).toBe(story.content.levels['9-10'].title);
    expect(tour.levels[0].words).toBeLessThan(tour.levels[1].words);
    expect(tour.levels[0].wordsPerSentence).toBeLessThan(tour.levels[1].wordsPerSentence);
    expect(story.content.levels['7-8'].paragraphs[0].startsWith(tour.levels[0].opening)).toBe(true);
  });

  it('shows a real question with exactly one right answer and one first try', () => {
    const q = tour.question!;
    const source = story.content.quiz[q.number - 1];
    expect(q.question).toBe(source.question);
    expect(q.total).toBe(story.content.quiz.length);
    expect(q.choices.filter((c) => c.state === 'right')).toHaveLength(1);
    expect(q.choices.filter((c) => c.state === 'first-try')).toHaveLength(1);
    expect(q.choices[source.answerIndex].state).toBe('right');
    expect(q.explanation).toBe(source.explanation);
  });

  it('marks the example draft without changing a word of it', () => {
    const write = tour.write!;
    const example = EXAMPLE_DRAFTS[story.slug];
    expect(draftText(write.draft).replace('^', '')).toBe(example.text);
    expect(write.notes.filter((n) => n.kind === 'Working')).toHaveLength(2);
    expect(write.notes.filter((n) => n.kind === 'Try next').length).toBeLessThanOrEqual(2);
    // Never more than four marks (DESIGN §11.12).
    expect(write.draft.filter((p) => p.kind !== 'text').length).toBeLessThanOrEqual(4);
    expect(write.words).toBeGreaterThanOrEqual(write.minWords);
    expect(write.vocabulary.some((v) => v.used)).toBe(true);
  });

  it('builds for every practice story (drafts only where one is written)', () => {
    for (const s of PRACTICE_STORIES) {
      const t = buildLessonTour(s);
      expect(t.levels).toHaveLength(2);
      expect(t.question).not.toBeNull();
      expect(t.write === null).toBe(!EXAMPLE_DRAFTS[s.slug]);
    }
  });
});

describe('markDraft', () => {
  it('marks whole words only and puts the caret after the first sentence', () => {
    const parts = markDraft('Also here. We also went, and also.', [{ phrase: 'also', mark: 'double' }], true);
    expect(draftText(parts)).toBe('Also here.^ We also went, and also.');
    expect(parts.find((p) => p.kind === 'mark')).toEqual({ kind: 'mark', text: 'also', mark: 'double' });
  });

  it('reads the first quote of a note', () => {
    expect(firstQuote('You used "community" in "…the community…".')).toBe('community');
    expect(firstQuote('No quote here.')).toBeNull();
  });
});
