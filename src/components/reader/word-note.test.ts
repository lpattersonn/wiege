import { describe, expect, it } from 'vitest';

import type { Definition } from '@/lib/literacy/types';

import { dictionaryNote, findVocab, isPlaceholderDefinition, saveFields, tidySentence, vocabNote, type ReaderVocab } from './word-note';

const vocab = (over: Partial<ReaderVocab> = {}): ReaderVocab => ({
  word: 'prototype',
  partOfSpeech: 'noun',
  definition: 'An early, rough version of something',
  example: 'Our first prototype could only turn left.',
  placeholder: false,
  inStory: { '7-8': 'Their first prototype was made of cardboard.', '9-10': null },
  ...over,
});

const dictionary: Definition = {
  word: 'suffer',
  meanings: [
    { partOfSpeech: 'noun', definitions: [{ definition: 'a made-up noun sense' }] },
    { partOfSpeech: 'verb', definitions: [{ definition: 'to experience something bad', example: 'she suffered a sprain' }] },
  ],
};

describe('vocabNote', () => {
  it('uses the lesson definition and the sentence from the story', () => {
    expect(vocabNote(vocab(), '7-8')).toEqual({
      word: 'prototype',
      partOfSpeech: 'noun',
      definition: 'An early, rough version of something.',
      inThisStory: '“Their first prototype was made of cardboard.”',
      example: 'Our first prototype could only turn left.',
    });
  });

  it('falls back to the other level’s sentence', () => {
    expect(vocabNote(vocab(), '9-10').inThisStory).toBe('“Their first prototype was made of cardboard.”');
  });

  it('drops an example that only repeats the story sentence', () => {
    const v = vocab({ example: 'Their first prototype was made of cardboard.' });
    expect(vocabNote(v, '7-8').example).toBeUndefined();
  });

  it('fills a placeholder definition from the dictionary, matching the part of speech', () => {
    const v = vocab({ word: 'suffered', partOfSpeech: 'verb', definition: 'A less common word from this story.', placeholder: true });
    const note = vocabNote(v, '7-8', dictionary);
    expect(note.definition).toBe('To experience something bad.');
    expect(note.example).toBe('She suffered a sprain.');
    // Without the dictionary the lesson's own text stays.
    expect(vocabNote(v, '7-8', null).definition).toBe('A less common word from this story.');
  });
});

describe('dictionaryNote', () => {
  it('builds a note with another meaning as the extra', () => {
    const note = dictionaryNote(dictionary, 'She suffered a knee injury.');
    expect(note).toMatchObject({ word: 'suffer', partOfSpeech: 'noun', definition: 'A made-up noun sense.', inThisStory: '“She suffered a knee injury.”' });
    expect(note?.extra).toEqual({ label: 'Another meaning', text: 'As a verb: to experience something bad.' });
  });

  it('returns null for an empty entry', () => {
    expect(dictionaryNote({ word: 'x', meanings: [] })).toBeNull();
  });
});

describe('helpers', () => {
  it('spots placeholder definitions', () => {
    expect(isPlaceholderDefinition('A less common word from this story. Use the sentence around it.')).toBe(true);
    expect(isPlaceholderDefinition('A word that means less')).toBe(false);
  });

  it('finds the lesson word for a tapped form', () => {
    const list = [vocab(), vocab({ word: 'collaborate' })];
    expect(findVocab(list, 'Prototypes')?.word).toBe('prototype');
    expect(findVocab(list, 'collaborated')?.word).toBe('collaborate');
    expect(findVocab(list, 'torch')).toBeNull();
  });

  it('tidies sentences and picks the fields to save', () => {
    expect(tidySentence(' hello there ')).toBe('Hello there.');
    expect(tidySentence('Done!')).toBe('Done!');
    expect(saveFields({ word: ' prototype ', definition: 'Def.' })).toEqual({ word: 'prototype', definition: 'Def.' });
  });
});
