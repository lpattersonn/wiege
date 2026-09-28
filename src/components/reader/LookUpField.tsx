'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { useWordEntry } from '@/components/local/hooks';
import { WordNoteContent, type WordNoteData } from '@/components/pen/WordNoteContent';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { SkeletonText } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { speakWord, useCanSpeak } from '@/components/ui/use-media-query';
import { isSaveableWord } from '@/lib/local/reducers';
import { getOwn, normalizeWordKey } from '@/lib/local/schema';
import { dispatch, getLocalState } from '@/lib/local/store';

import { announce } from './celebrate';
import { lookupWord } from './define-client';
import { useReader } from './ReaderRoot';
import { lookupKey } from './text';
import { dictionaryNote, findVocab, saveFields, vocabNote, type ReaderVocab } from './word-note';

/**
 * "Look up a word" (SPEC §8, DESIGN §12.4): the keyboard way to any word's
 * note, in the reading settings panel. Lesson words answer from the lesson;
 * anything else asks /api/define. The note appears right under the field.
 */
type Result = { status: 'loading'; word: string } | { status: 'ready'; data: WordNoteData; canSave: boolean; audioUrl?: string } | { status: 'error'; message: string };

export function LookUpField({ vocabulary }: { vocabulary: ReaderVocab[] }) {
  const { story, level, prefs } = useReader();
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const request = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const canSpeak = useCanSpeak() === true;
  const noteWord = result?.status === 'ready' ? result.data.word : '';
  const saved = Boolean(useWordEntry(noteWord) && noteWord);

  // The panel scrolls (sheet, popover): bring a new answer into view.
  useEffect(() => {
    if (result?.status === 'ready' || result?.status === 'error') resultRef.current?.scrollIntoView({ block: 'nearest' });
  }, [result]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const typed = value.trim();
    const key = lookupKey(typed);
    if (!key || /\s/.test(key)) {
      setError('Type one word, then press Look up.');
      return;
    }
    setError(null);
    const vocab = findVocab(vocabulary, typed);
    if (vocab && !vocab.placeholder) {
      setResult({ status: 'ready', data: vocabNote(vocab, level), canSave: isSaveableWord(vocab.word) });
      return;
    }
    const mine = ++request.current;
    setResult({ status: 'loading', word: vocab?.word ?? typed });
    const answer = await lookupWord(vocab ? lookupKey(vocab.word) : key);
    if (mine !== request.current) return;
    if (vocab) {
      const definition = answer.status === 'found' ? answer.definition : null;
      setResult({ status: 'ready', data: vocabNote(vocab, level, definition), canSave: isSaveableWord(vocab.word), audioUrl: definition?.audioUrl });
      return;
    }
    const data = answer.status === 'found' ? dictionaryNote(answer.definition) : null;
    if (data && answer.status === 'found') setResult({ status: 'ready', data, canSave: isSaveableWord(data.word), audioUrl: answer.definition.audioUrl });
    else setResult({ status: 'error', message: answer.status === 'error' ? answer.message : 'That word isn’t in the dictionary. Check the spelling.' });
  }

  function toggleSave() {
    if (result?.status !== 'ready' || !result.canSave) return;
    const existing = getOwn(getLocalState().words, normalizeWordKey(result.data.word));
    if (existing) {
      dispatch({ type: 'removeWord', word: existing.word });
      toast({ message: `Removed “${existing.word}”.`, action: { label: 'Undo', onAction: () => dispatch({ type: 'restoreWord', entry: existing }) } });
      return;
    }
    const events = dispatch({ type: 'saveWord', ...saveFields(result.data), storySlug: story.slug, storyTitle: story.titles[level] });
    announce(`Saved “${result.data.word}” to your words.`, events);
  }

  const audioUrl = result?.status === 'ready' ? result.audioUrl : undefined;
  function speak() {
    if (!noteWord) return;
    if (canSpeak) speakWord(noteWord, 0.85 * (prefs?.readAloudRate ?? 1));
    else if (audioUrl) new Audio(audioUrl).play().catch(() => {});
  }

  return (
    <div className="grid gap-4 border-t border-line-soft pt-6">
      <form onSubmit={onSubmit} className="grid gap-3" noValidate>
        <TextInput
          id={`${id}-word`}
          label="Look up a word"
          helper="Any word from the story, or one you’re wondering about."
          error={error ?? undefined}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={40}
        />
        <Button type="submit" variant="secondary" size="sm" className="justify-self-start">
          Look up
        </Button>
      </form>
      <div ref={resultRef} aria-live="polite" className="scroll-mb-4">
        {result?.status === 'loading' ? (
          <div aria-busy="true">
            <p className="type-note-word">{result.word}</p>
            <p className="sr-only">Looking up the word.</p>
            <SkeletonText lines={3} className="mt-3" />
          </div>
        ) : result?.status === 'ready' ? (
          <WordNoteContent
            key={result.data.word}
            data={result.data}
            saved={saved}
            onSave={toggleSave}
            canSave={result.canSave}
            canSpeak={canSpeak || Boolean(audioUrl)}
            onSpeak={speak}
          />
        ) : result?.status === 'error' ? (
          <p className="text-ui leading-normal text-ink-2">{result.message}</p>
        ) : null}
      </div>
    </div>
  );
}
