import type { WordNoteData } from '@/components/pen/WordNoteContent';
import type { Definition, GradeBand } from '@/lib/literacy/types';
import { sameWordFamily } from '@/lib/literacy/word-forms';

import { lookupKey, quoteSentence, straightQuotes } from './text';

/**
 * Word-note data for the reader (DESIGN §8.7), built from the lesson's own
 * vocabulary or from a /api/define result. Pure and isomorphic.
 */

/** A lesson vocabulary item as the reader's client islands receive it. */
export interface ReaderVocab {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  /** The offline lesson only had a placeholder definition: ask the dictionary. */
  placeholder: boolean;
  /** The sentence where the word first appears, per level (null when it isn't in that level). */
  inStory: Record<GradeBand, string | null>;
}

/** Heuristic lessons use this placeholder when their word list has no definition (BACKEND-NOTES). */
export function isPlaceholderDefinition(definition: string): boolean {
  return /^a less common word\b/i.test(definition.trim());
}

const same = (a: string, b: string) => straightQuotes(a).trim().toLowerCase() === straightQuotes(b).trim().toLowerCase();

/** The lesson item a tapped word belongs to (same word or another form of it), if any. */
export function findVocab(vocabulary: readonly ReaderVocab[], tapped: string): ReaderVocab | null {
  const key = lookupKey(tapped);
  if (!key) return null;
  return (
    vocabulary.find((v) => lookupKey(v.word) === key) ??
    vocabulary.find((v) => !/\s/.test(v.word.trim()) && key.length >= 3 && sameWordFamily(v.word, key)) ??
    null
  );
}

function firstSense(definition: Definition, partOfSpeech?: string) {
  const meaning =
    (partOfSpeech && definition.meanings.find((m) => m.partOfSpeech.toLowerCase() === partOfSpeech.toLowerCase() && m.definitions.length > 0)) ||
    definition.meanings.find((m) => m.definitions.length > 0);
  if (!meaning) return null;
  const sense = meaning.definitions[0];
  const example = sense.example ?? meaning.definitions.find((d) => d.example)?.example;
  return { meaning, definition: sense.definition, example };
}

/** Capital first letter, full stop at the end: dictionary senses arrive in many shapes. */
export function tidySentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?…"”’)]$/.test(capital) ? capital : `${capital}.`;
}

/** Note for a lesson word. `dictionary` fills in placeholder definitions when the lookup worked. */
export function vocabNote(vocab: ReaderVocab, level: GradeBand, dictionary?: Definition | null): WordNoteData {
  const sentence = vocab.inStory[level] ?? vocab.inStory[level === '7-8' ? '9-10' : '7-8'];
  const fromDictionary = vocab.placeholder && dictionary ? firstSense(dictionary, vocab.partOfSpeech) : null;
  const definition = fromDictionary ? fromDictionary.definition : vocab.definition;
  // Offline lessons sometimes use the story's own sentence as the example; don't show it twice.
  const lessonExample = vocab.example && !(sentence && same(vocab.example, sentence)) ? vocab.example : undefined;
  const example = fromDictionary?.example ?? lessonExample;
  return {
    word: vocab.word,
    partOfSpeech: vocab.partOfSpeech || undefined,
    definition: tidySentence(definition),
    inThisStory: sentence ? quoteSentence(sentence) : undefined,
    example: example ? tidySentence(example) : undefined,
  };
}

/** Note for any other word, from the dictionary. */
export function dictionaryNote(definition: Definition, inThisStory?: string | null): WordNoteData | null {
  const first = firstSense(definition);
  if (!first) return null;
  const other = definition.meanings.find((m) => m.partOfSpeech !== first.meaning.partOfSpeech && m.definitions.length > 0);
  return {
    word: definition.word,
    partOfSpeech: first.meaning.partOfSpeech || undefined,
    definition: tidySentence(first.definition),
    inThisStory: inThisStory ? quoteSentence(inThisStory) : undefined,
    example: first.example ? tidySentence(first.example) : undefined,
    extra: other ? { label: 'Another meaning', text: `As ${article(other.partOfSpeech)} ${other.partOfSpeech}: ${lowerFirst(other.definitions[0].definition)}` } : undefined,
  };
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
const lowerFirst = (text: string) => {
  const t = tidySentence(text);
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
};

/** What "Save word" stores (SPEC §4 saveWord). */
export function saveFields(note: WordNoteData): { word: string; definition: string; example?: string; partOfSpeech?: string } {
  return {
    word: note.word.trim(),
    definition: note.definition,
    ...(note.example ? { example: note.example } : {}),
    ...(note.partOfSpeech ? { partOfSpeech: note.partOfSpeech } : {}),
  };
}
