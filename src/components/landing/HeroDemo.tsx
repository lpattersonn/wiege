'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { FolioMain, FolioMargin } from '@/components/layout/PageContainer';
import { PersistenceNotice } from '@/components/local/PersistenceNotice';
import { MarginNote } from '@/components/pen/MarginNote';
import { WordsKeptMeter } from '@/components/pen/marks';
import { useTapWord } from '@/components/pen/tap-store';
import { TapWord } from '@/components/pen/TapWord';
import { WordNoteContent } from '@/components/pen/WordNoteContent';
import { toast } from '@/components/ui/Toast';
import { MEDIA, speakWord, useCanSpeak, useMediaQuery } from '@/components/ui/use-media-query';
import { getOwn, normalizeWordKey, type LocalState } from '@/lib/local/schema';
import { dispatch, getLocalState, useLocal } from '@/lib/local/store';

import type { HeroDemo as HeroDemoData, HeroNote } from './hero-demo';

const GROUP = 'landing-hero';
const NOTE_ID = 'hero-note';

/**
 * The landing hero's tap-a-word demo (DESIGN §12.1, §14 reciprocity): the
 * practice story's passage with its dotted vocabulary words. Tapping one
 * circles it and writes the note in the right margin (≥ 1024px) or inline
 * under the passage; "Save word" really saves it on this device, so the nav's
 * Words count and the "0 of 3 words kept" meter move.
 *
 * At ≥ 1024px the first word opens by itself once (the page's one pen moment).
 * That note is not announced: the note's aria-live stays off until the student
 * first acts (pointer, key or focus on a word).
 *
 * The heading and meta row arrive as server-rendered `head`. In the margin the
 * note sits in an absolutely positioned layer, so opening it never grows the
 * grid row (no layout shift); the page reserves room for it in CSS.
 */
export function HeroDemo({ demo, head }: { demo: Pick<HeroDemoData, 'slug' | 'title' | 'passage' | 'notes'>; head: ReactNode }) {
  const open = useTapWord(GROUP);
  const wide = useMediaQuery(MEDIA.lg);
  const canSpeak = useCanSpeak() === true;
  const [armed, setArmed] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const notesByKey = useMemo(() => new Map(demo.notes.map((n) => [n.key, n])), [demo.notes]);
  const headwords = useMemo(() => demo.notes.map((n) => normalizeWordKey(n.word)).join('\n'), [demo.notes]);
  // One string, so the selector's result is stable between renders.
  const selectBoxes = useCallback(
    (s: LocalState) =>
      headwords
        .split('\n')
        .map((key) => getOwn(s.words, key)?.box ?? 0)
        .join(','),
    [headwords],
  );
  const boxesText = useLocal(selectBoxes);
  const boxes = useMemo(() => (boxesText ? boxesText.split(',').map(Number) : demo.notes.map(() => 0)), [boxesText, demo.notes]);
  const boxFor = (note: HeroNote) => boxes[demo.notes.indexOf(note)] ?? 0;
  const kept = boxes.filter((b) => b > 0).length;

  // Keep the note's live region quiet until the student acts (the pre-open is not theirs).
  useEffect(() => {
    if (armed) return;
    const arm = () => setArmed(true);
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.getAttribute('aria-controls') === NOTE_ID) arm();
    };
    window.addEventListener('pointerdown', arm, { capture: true });
    window.addEventListener('keydown', arm, { capture: true });
    document.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('pointerdown', arm, { capture: true });
      window.removeEventListener('keydown', arm, { capture: true });
      document.removeEventListener('focusin', onFocus);
    };
  }, [armed]);

  const note = open ? notesByKey.get(open.word.toLowerCase()) : undefined;
  const saved = note ? boxFor(note) > 0 : false;

  function toggleSave(n: HeroNote) {
    const existing = getOwn(getLocalState().words, normalizeWordKey(n.word));
    if (existing) {
      dispatch({ type: 'removeWord', word: n.word });
      setJustSaved(false);
      toast({ message: `Removed “${n.word}”.`, action: { label: 'Undo', onAction: () => dispatch({ type: 'restoreWord', entry: existing }) } });
      return;
    }
    dispatch({
      type: 'saveWord',
      word: n.word,
      definition: n.definition,
      example: n.example,
      partOfSpeech: n.partOfSpeech,
      storySlug: demo.slug,
      storyTitle: demo.title,
    });
    setJustSaved(true);
  }

  const inline = wide === false && Boolean(note);
  const noteElement = (
    <MarginNote id={NOTE_ID} open={Boolean(note)} anchor={open?.anchor} placement={wide ? 'margin' : 'inline'} animate swapKey={open?.serial} live={armed}>
      {note ? (
        <WordNoteContent
          data={{ word: note.word, partOfSpeech: note.partOfSpeech, definition: note.definition, example: note.example }}
          saved={saved}
          onSave={() => toggleSave(note)}
          canSpeak={canSpeak}
          onSpeak={() => speakWord(note.word)}
        />
      ) : null}
    </MarginNote>
  );

  const firstWord = demo.passage.findIndex((part) => part.kind === 'word');
  return (
    <>
      <FolioMain>
        {head}
        <p className="mt-6 type-standfirst">
          {demo.passage.map((part, i) => {
            if (part.kind === 'text') return <span key={i}>{part.text}</span>;
            const n = notesByKey.get(part.text.toLowerCase());
            return (
              <TapWord
                key={i}
                word={part.text}
                trailing={part.trailing}
                group={GROUP}
                controls={NOTE_ID}
                scope={demo.slug}
                mastery={n ? boxFor(n) : 0}
                preOpen={i === firstWord}
              />
            );
          })}
        </p>
        {inline ? noteElement : null}
        {demo.notes.length ? (
          <WordsKeptMeter kept={kept} total={demo.notes.length} animateIndex={justSaved && kept > 0 ? kept - 1 : undefined} className="mt-6" />
        ) : null}
        <PersistenceNotice className="mt-4 max-w-[32em]" />
      </FolioMain>
      <FolioMargin>
        <div className="lg:absolute lg:inset-0">{inline ? null : noteElement}</div>
      </FolioMargin>
    </>
  );
}
