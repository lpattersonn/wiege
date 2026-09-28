'use client';

import { useWordEntry } from '@/components/local/hooks';
import { TapWord } from '@/components/pen/TapWord';

import { NOTE_ID, TAP_GROUP } from './ids';

/**
 * A lesson word in the story (DESIGN §8.6, §8.8): a <TapWord> in the reader's
 * tap group that shows the student's mastery mark once the word is in their
 * collection (the dotted underline until then). Marks are absolutely
 * positioned, so switching from dots to a mark after hydration shifts nothing.
 */
export function ReaderWord({ word, text, leading, trailing, scope }: { word: string; text: string; leading?: string; trailing?: string; scope: string }) {
  const entry = useWordEntry(word);
  const tap = (
    <TapWord word={word} group={TAP_GROUP} controls={NOTE_ID} mastery={entry?.box ?? 0} scope={scope} trailing={trailing || undefined}>
      {text}
    </TapWord>
  );
  return (
    <span data-vocab={word} className={leading ? 'nobr' : undefined}>
      {leading}
      {tap}
    </span>
  );
}
