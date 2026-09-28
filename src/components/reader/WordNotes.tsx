'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { useWordEntry } from '@/components/local/hooks';
import { MarginNote } from '@/components/pen/MarginNote';
import { LOOP_INSETS } from '@/components/pen/metrics';
import { Loop } from '@/components/pen/PenMark';
import { closeTapWord, openTapWord, useTapWord } from '@/components/pen/tap-store';
import { WordNoteContent, type WordNoteData } from '@/components/pen/WordNoteContent';
import { WordSheet } from '@/components/pen/WordSheet';
import { buttonClasses } from '@/components/ui/Button';
import { SkeletonText } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { MEDIA, speakWord, useCanSpeak, useMediaQuery } from '@/components/ui/use-media-query';
import type { Definition } from '@/lib/literacy/types';
import { isSaveableWord } from '@/lib/local/reducers';
import { getOwn, normalizeWordKey } from '@/lib/local/schema';
import { dispatch, getLocalState } from '@/lib/local/store';

import { announce } from './celebrate';
import { lookupWord, type LookupResult } from './define-client';
import { rectsWithin, wordAtPoint, type WordHit } from './dom';
import { NOTE_ID, OVERLAY_ID, STORY_BODY_ID, TAP_GROUP } from './ids';
import { useReader } from './ReaderRoot';
import { lookupKey, sentenceAround } from './text';
import { dictionaryNote, findVocab, saveFields, vocabNote, type ReaderVocab } from './word-note';

/**
 * Word notes for the reader (SPEC §8, DESIGN §8.6–8.7, §11.9). One note at a
 * time, shared through the tap store's "reader" group:
 *
 * - Lesson words are <TapWord> buttons in the text; their note uses the
 *   lesson's definition (or the dictionary, for placeholder definitions).
 * - Any other word: a tap resolves the word under the pointer
 *   (caretPositionFromPoint, no per-word spans); a pen loop is drawn over it
 *   in an overlay, and the note comes from /api/define. Selecting a word shows
 *   a "Define" button (Enter works too).
 * - ≥ 1024px the note sits in the margin beside the word; below that it is a
 *   non-modal bottom sheet and the word scrolls above it.
 *
 * "Save word" is optimistic (the store updates synchronously), toggles to
 * "Saved to your words", and can be undone.
 */

interface FreeLookup {
  instance: string;
  /** The word as tapped. */
  word: string;
  key: string;
  sentence: string;
  vocab: ReaderVocab | null;
}

type NoteView = { status: 'loading'; word: string } | { status: 'ready'; data: WordNoteData; canSave: boolean; audioUrl?: string };

const noopSubscribe = () => () => {};
const getOverlay = () => document.getElementById(OVERLAY_ID);
const noOverlay = () => null;

let freeCount = 0;

export function WordNotes({ vocabulary }: { vocabulary: ReaderVocab[] }) {
  const { story, level, prefs } = useReader();
  const open = useTapWord(TAP_GROUP);
  const wide = useMediaQuery(MEDIA.lg);
  const canSpeak = useCanSpeak() === true;
  const overlay = useSyncExternalStore(noopSubscribe, getOverlay, noOverlay);

  const [free, setFree] = useState<FreeLookup | null>(null);
  const [lookup, setLookup] = useState<{ key: string; result: LookupResult } | null>(null);
  const [bubble, setBubble] = useState<{ key: string; left: number; top: number } | null>(null);

  const anchorRef = useRef<HTMLSpanElement>(null);
  const loopBoxRef = useRef<HTMLSpanElement>(null);
  const freeRange = useRef<Range | null>(null);
  const headwordRef = useRef<HTMLParagraphElement>(null);
  const focusNote = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const vocabByKey = useMemo(() => new Map(vocabulary.map((v) => [v.word, v])), [vocabulary]);
  const isFree = Boolean(open && free && open.instance === free.instance);
  const vocab = open ? (isFree ? free?.vocab ?? null : vocabByKey.get(open.word) ?? null) : null;

  /** The word that needs the dictionary, if any. */
  const needsLookup = open ? (vocab ? (vocab.placeholder ? lookupKey(vocab.word) : null) : isFree ? free?.key ?? null : null) : null;

  useEffect(() => {
    if (!needsLookup) return;
    const controller = new AbortController();
    lookupWord(needsLookup, controller.signal)
      .then((result) => setLookup({ key: needsLookup, result }))
      .catch(() => {});
    return () => controller.abort();
  }, [needsLookup]);

  const view: NoteView | null = useMemo(() => {
    if (!open) return null;
    const pending = needsLookup !== null && lookup?.key !== needsLookup;
    const result = needsLookup !== null && !pending ? lookup?.result : undefined;
    const definition: Definition | null = result?.status === 'found' ? result.definition : null;
    if (vocab) {
      // Lesson words can always be saved with the lesson's own definition (even when the dictionary is down).
      if (pending) return { status: 'loading', word: vocab.word };
      return { status: 'ready', data: vocabNote(vocab, level, definition), canSave: isSaveableWord(vocab.word), audioUrl: definition?.audioUrl };
    }
    if (!isFree || !free) return null;
    if (pending || !result) return { status: 'loading', word: free.word };
    if (definition) {
      const data = dictionaryNote(definition, free.sentence);
      if (data) return { status: 'ready', data, canSave: isSaveableWord(data.word), audioUrl: definition.audioUrl };
    }
    const message = result.status === 'error' ? result.message : 'That word isn’t in the dictionary. Check the spelling, or try another form of the word.';
    return { status: 'ready', data: { word: free.word, definition: message }, canSave: false };
  }, [open, needsLookup, lookup, vocab, level, isFree, free]);

  const noteWord = view?.status === 'ready' ? view.data.word : '';
  const entry = useWordEntry(noteWord);
  const saved = Boolean(noteWord && entry);

  // ---- placing the free-word loop -------------------------------------------------

  const placeAnchor = useCallback(() => {
    const anchor = anchorRef.current;
    const loopBox = loopBoxRef.current;
    const range = freeRange.current;
    if (!anchor || !loopBox || !range || !overlay) return undefined;
    const [rect] = rectsWithin(range, overlay);
    if (!rect) return undefined;
    // The anchor box runs from the word to the end of its line, so the margin note's leader
    // arrow stops after the line (as it does for tap words) instead of crossing it.
    let lineRight = rect.left + rect.width;
    const paragraph = range.startContainer.parentElement?.closest('[data-para]');
    if (paragraph) {
      const line = document.createRange();
      line.selectNodeContents(paragraph);
      const base = overlay.getBoundingClientRect();
      for (const r of Array.from(line.getClientRects())) {
        const top = r.top - base.top;
        if (r.width && top < rect.top + rect.height - 4 && top + r.height > rect.top + 4) lineRight = Math.max(lineRight, r.right - base.left);
      }
    }
    const size = parseFloat(getComputedStyle(range.startContainer.parentElement ?? overlay).fontSize) || 20;
    Object.assign(anchor.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${lineRight - rect.left}px`, height: `${rect.height}px`, fontSize: `${size}px` });
    loopBox.style.width = `${rect.width}px`;
    const inset = LOOP_INSETS.read;
    return (rect.width + 2 * inset.lx * size) / (rect.height + (inset.lt + inset.lb) * size);
  }, [overlay]);

  useEffect(() => {
    if (!overlay || !isFree) return;
    const observer = new ResizeObserver(() => placeAnchor());
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [overlay, isFree, placeAnchor]);

  const openFree = useCallback(
    (hit: WordHit) => {
      const key = lookupKey(hit.word);
      const anchor = anchorRef.current;
      if (!key || !anchor) return;
      freeRange.current = hit.range;
      const aspect = placeAnchor();
      const instance = `free:${++freeCount}`;
      const vocabHit = findVocab(vocabulary, hit.word);
      setFree({ instance, word: hit.word, key, sentence: sentenceAround(hit.paragraph.textContent ?? '', hit.index), vocab: vocabHit });
      openTapWord(TAP_GROUP, vocabHit?.word ?? key, anchor, instance, aspect);
    },
    [placeAnchor, vocabulary],
  );

  // A level switch replaces the text under a free word: close it (lesson words are handled by ReaderRoot).
  const levelRef = useRef(level);
  useEffect(() => {
    if (levelRef.current === level) return;
    levelRef.current = level;
    if (isFree) closeTapWord(TAP_GROUP);
  }, [level, isFree]);

  // ---- taps and clicks on the story ---------------------------------------------------

  useEffect(() => {
    const body = document.getElementById(STORY_BODY_ID);
    if (!body) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const tap = target?.closest('button.tap');
      if (tap) {
        // Enter or Space on a tap word (a click with no pointer): take the student into the note.
        if (event.detail === 0) focusNote.current = true;
        return;
      }
      if (event.button !== 0 || event.detail > 1 || target?.closest('button, a, input, textarea, select, label')) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      const hit = wordAtPoint(event.clientX, event.clientY, body);
      if (!hit) return;
      openFree(hit);
    };
    body.addEventListener('click', onClick);
    return () => body.removeEventListener('click', onClick);
  }, [openFree]);

  // ---- "Define" after selecting a word ---------------------------------------------------

  useEffect(() => {
    let timer = 0;
    const update = () => {
      const selection = window.getSelection();
      const body = document.getElementById(STORY_BODY_ID);
      const text = selection?.toString().trim() ?? '';
      if (!selection || selection.isCollapsed || !selection.rangeCount || !body || !body.contains(selection.getRangeAt(0).commonAncestorContainer) || !text || /\s/.test(text) || text.length > 40) {
        setBubble(null);
        return;
      }
      const rects = selection.getRangeAt(0).getClientRects();
      const last = rects[rects.length - 1];
      if (!last) return setBubble(null);
      const below = window.matchMedia('(pointer: coarse)').matches || last.top < 120;
      // Viewport coordinates (the bubble is fixed); it follows the selection on scroll and resize.
      setBubble({
        key: lookupKey(text),
        left: Math.max(8, Math.min(last.right - 44, window.innerWidth - 104)),
        top: below ? last.bottom + 10 : last.top - 50,
      });
    };
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 120);
    };
    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    document.addEventListener('selectionchange', onChange);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', onChange);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const defineSelection = useCallback(
    (fromKeyboard: boolean) => {
      const selection = window.getSelection();
      const body = document.getElementById(STORY_BODY_ID);
      if (!selection || !selection.rangeCount || !body) return;
      const rect = selection.getRangeAt(0).getClientRects()[0];
      const hit = rect ? wordAtPoint(rect.left + Math.min(rect.width / 2, 6), rect.top + rect.height / 2, body) : null;
      selection.removeAllRanges();
      setBubble(null);
      if (!hit) return;
      focusNote.current = fromKeyboard;
      openFree(hit);
    },
    [openFree],
  );

  useEffect(() => {
    if (!bubble) return;
    const onKey = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (event.key !== 'Enter' || (active && active !== document.body && active.closest('button, a, input, textarea, select, [contenteditable]'))) return;
      event.preventDefault();
      defineSelection(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [bubble, defineSelection]);

  // ---- after opening: bring the word above the sheet, or focus into the margin note ----------

  const serial = open?.serial;
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = isFree ? null : open.anchor;
    if (wide === false) {
      // The sheet covers the bottom half: tap words carry scroll-margin-bottom 45svh.
      window.requestAnimationFrame(() => open.anchor.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
    // Only runs when a new word opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial]);

  useEffect(() => {
    if (!focusNote.current || !view || wide === false) return;
    focusNote.current = false;
    headwordRef.current?.focus({ preventScroll: true });
  }, [view, wide]);

  // ---- saving and speaking ---------------------------------------------------------------

  const toggleSave = useCallback(() => {
    if (view?.status !== 'ready' || !view.canSave) return;
    const { data } = view;
    const key = normalizeWordKey(data.word);
    const existing = getOwn(getLocalState().words, key);
    if (existing) {
      dispatch({ type: 'removeWord', word: data.word });
      toast({ message: `Removed “${existing.word}”.`, action: { label: 'Undo', onAction: () => dispatch({ type: 'restoreWord', entry: existing }) } });
      return;
    }
    const events = dispatch({ type: 'saveWord', ...saveFields(data), storySlug: story.slug, storyTitle: story.titles[level] });
    announce(`Saved “${data.word}” to your words.`, events);
  }, [view, story, level]);

  const audioUrl = view?.status === 'ready' ? view.audioUrl : undefined;
  const speak = useCallback(() => {
    if (!noteWord) return;
    if (canSpeak) speakWord(noteWord, 0.85 * (prefs?.readAloudRate ?? 1));
    else if (audioUrl) new Audio(audioUrl).play().catch(() => {});
  }, [noteWord, canSpeak, audioUrl, prefs]);

  const speakable = canSpeak || Boolean(audioUrl);
  const close = useCallback(() => closeTapWord(TAP_GROUP, { returnFocus: !isFree }), [isFree]);

  const content =
    view?.status === 'ready' ? (
      <WordNoteContent
        key={view.data.word}
        data={view.data}
        headwordRef={headwordRef}
        saved={saved}
        onSave={toggleSave}
        canSave={view.canSave}
        canSpeak={speakable}
        onSpeak={speak}
      />
    ) : view?.status === 'loading' ? (
      <div aria-busy="true">
        <p ref={headwordRef} tabIndex={-1} className="type-note-word outline-offset-4">
          {view.word}
        </p>
        <p className="sr-only">Looking up the word.</p>
        <SkeletonText lines={3} className="mt-3" />
      </div>
    ) : null;

  const loopStyle = { '--lt': '.2em', '--lb': '.14em', '--lx': '.11em', '--pen-scale': 1.05, scrollMarginTop: 136, scrollMarginBottom: '45svh' } as CSSProperties;

  return (
    <>
      {wide === false ? (
        <WordSheet
          id={NOTE_ID}
          open={Boolean(open)}
          onClose={close}
          data={view?.status === 'ready' ? view.data : null}
          saved={saved}
          onSave={view?.status === 'ready' && view.canSave ? toggleSave : undefined}
          canSave={view?.status === 'ready' ? view.canSave : false}
          canSpeak={speakable}
          onSpeak={speak}
          returnFocusRef={returnFocusRef}
        />
      ) : (
        <MarginNote id={NOTE_ID} open={Boolean(open && view)} anchor={open?.anchor} placement="margin" animate swapKey={serial}>
          {content}
        </MarginNote>
      )}
      {overlay
        ? createPortal(
            <span ref={anchorRef} className="absolute block" style={loopStyle}>
              <span ref={loopBoxRef} className="absolute inset-y-0 left-0 block">
                {isFree && open ? <Loop key={open.serial} word={free?.word} scope={story.slug} aspect={open.aspect} animate /> : null}
              </span>
            </span>,
            overlay,
          )
        : null}
      {bubble && typeof document !== 'undefined'
        ? createPortal(
            <button
              type="button"
              className={buttonClasses({ variant: 'primary', size: 'sm', className: 'z-70' })}
              // Inline: the button classes carry `position: relative`.
              style={{ position: 'fixed', left: bubble.left, top: bubble.top }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => defineSelection(event.detail === 0)}
            >
              Define
            </button>,
            document.body,
          )
        : null}
    </>
  );
}
