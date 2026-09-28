import { describe, expect, it } from 'vitest';

import { getLandingDemoStory, PRACTICE_STORIES } from '@/lib/literacy/samples';
import type { LessonContent } from '@/lib/literacy/types';

import { asSentence, buildHeroDemo, splitSentencesKeepingText, tokenizePassage, tokenMatches } from './hero-demo';

const passageText = (parts: ReturnType<typeof buildHeroDemo>['passage']) =>
  parts.map((p) => (p.kind === 'word' ? `${p.text}${p.trailing ?? ''}` : p.text)).join('');

describe('buildHeroDemo', () => {
  it('builds the landing demo from the libraries practice story', () => {
    const demo = buildHeroDemo(getLandingDemoStory());
    expect(demo.title).toBe('Libraries lend more than books');
    expect(demo.category).toBe('writing');
    expect(demo.minutes).toBeGreaterThanOrEqual(1);
    expect(demo.notes.map((n) => n.word)).toEqual(['purpose', 'access', 'resources']);
    expect(passageText(demo.passage)).toBe(
      'Librarians say these collections fit what libraries have always done. Their purpose is to give everyone access to knowledge and useful resources, whatever they can afford.',
    );
    // Trailing punctuation rides with its word so a comma never starts a line.
    expect(demo.passage).toContainEqual({ kind: 'word', text: 'resources', trailing: ',' });
    expect(demo.notes[0]).toMatchObject({ key: 'purpose', partOfSpeech: 'noun', definition: 'The reason something exists or is done.' });
  });

  it('only quotes text that is really in the story, for every practice story', () => {
    for (const story of PRACTICE_STORIES) {
      const demo = buildHeroDemo(story);
      const retelling = story.content.levels['7-8'].paragraphs.join(' ');
      expect(retelling).toContain(passageText(demo.passage));
      expect(demo.notes.length).toBeGreaterThan(0);
      expect(demo.notes.length).toBeLessThanOrEqual(3);
      // Every tap word in the passage has exactly one note.
      const words = demo.passage.filter((p) => p.kind === 'word');
      expect(words.map((w) => w.text.toLowerCase())).toEqual(demo.notes.map((n) => n.key));
    }
  });

  it('matches inflected forms to their vocabulary entry and keeps the text as written', () => {
    const content = {
      keyIdea: 'x',
      levels: {
        '7-8': { title: 'Title', paragraphs: ['Nothing here. The team explored caves. Their communities helped, and they adjusted plans.'] },
        '9-10': { title: 'Title', paragraphs: ['x'] },
      },
      vocabulary: [
        { word: 'explore', partOfSpeech: 'verb', definition: 'to look around', example: 'We explored.', band: 'both' },
        { word: 'community', partOfSpeech: 'noun', definition: 'a group', example: 'Our community.', band: '7-8' },
        { word: 'adjust', partOfSpeech: 'verb', definition: 'to change a little', example: 'Adjust it.', band: 'both' },
        { word: 'by heart', partOfSpeech: 'idiom', definition: 'from memory', example: 'I know it by heart.', band: 'both' },
      ],
      quiz: [],
      writingPrompts: [],
      discussion: [],
    } as unknown as LessonContent;
    const demo = buildHeroDemo({ slug: 's', category: 'games', content });
    expect(demo.notes.map((n) => [n.key, n.word])).toEqual([
      ['explored', 'explore'],
      ['communities', 'community'],
      ['adjusted', 'adjust'],
    ]);
    expect(passageText(demo.passage)).toBe('Nothing here. The team explored caves. Their communities helped, and they adjusted plans.');
  });

  it('falls back to plain text when no vocabulary word appears', () => {
    const content = {
      keyIdea: 'x',
      levels: { '7-8': { title: 'T', paragraphs: ['One. Two. Three.'] }, '9-10': { title: 'T', paragraphs: ['x'] } },
      vocabulary: [{ word: 'absent', partOfSpeech: 'adjective', definition: 'not here', example: 'x', band: 'both' }],
      quiz: [],
      writingPrompts: [],
      discussion: [],
    } as unknown as LessonContent;
    const demo = buildHeroDemo({ slug: 's', category: 'art', content });
    expect(demo.notes).toEqual([]);
    expect(demo.passage).toEqual([{ kind: 'text', text: 'One. Two.' }]);
  });
});

describe('helpers', () => {
  it('splits sentences without losing quotes', () => {
    expect(splitSentencesKeepingText('Some call it a “library of things.” The idea is simple. Right?')).toEqual([
      'Some call it a “library of things.”',
      'The idea is simple.',
      'Right?',
    ]);
  });

  it('turns definitions into sentences', () => {
    expect(asSentence('the reason something exists')).toBe('The reason something exists.');
    expect(asSentence('Already done.')).toBe('Already done.');
  });

  it('matches word forms', () => {
    expect(tokenMatches('resources', 'resources')).toBe(true);
    expect(tokenMatches('Explored', 'explore')).toBe(true);
    expect(tokenMatches('exploit', 'explore')).toBe(false);
  });

  it('keeps trailing punctuation with its word', () => {
    const { parts } = tokenizePassage('We know it by heart.” Then', [
      { word: 'heart', partOfSpeech: 'noun', definition: 'd', example: 'e', band: 'both' },
    ]);
    expect(parts).toEqual([
      { kind: 'text', text: 'We know it by ' },
      { kind: 'word', text: 'heart', trailing: '.”' },
      { kind: 'text', text: ' Then' },
    ]);
  });
});
