'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { IconChevronDown } from '@/components/glyphs/icons';
import { MiniTick } from '@/components/pen/marks';
import { Button } from '@/components/ui/Button';
import { VocabChip } from '@/components/ui/Chip';
import { Textarea } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import { computeWritingStats, findUsedVocabulary, heuristicFeedback, type FeedbackInput } from '@/lib/literacy/feedback-core';
import type { WritingFeedback } from '@/lib/literacy/types';
import { getOwn, type JournalEntry, type LocalState } from '@/lib/local/schema';
import { dispatch, getLocalState, useHydrated, useLocal, usePersistent } from '@/lib/local/store';
import type { LocalEvents } from '@/lib/local/reducers';
import { BADGES } from '@/lib/progress/badges';
import { countWords } from '@/lib/progress/text';

import { feedbackNotes, planMarks } from './feedback-marks';
import { FeedbackPanel } from './FeedbackPanel';
import { findResumableEntry, newEntryId, targetState, targetText, toJournalKind, wordTarget } from './journal-helpers';
import { MarkedDraft } from './MarkedDraft';
import { AI_MAX_CHARS, AI_MIN_WORDS, NOT_ON_SITE_MESSAGE, requestAiFeedback, siteHasAi } from './request-feedback';

/**
 * The writing editor (DESIGN §11.12, SPEC §8 Write), shared by the reader's
 * inline editor and /journal/[id]. The props below are the contract; keep them
 * stable.
 *
 * - Literata 20/1.9 textarea (19 on mobile) that grows with the draft; the
 *   word count against the target ("38 words, aim for 30 to 80"); story
 *   vocabulary chips that tick exactly as the feedback counts them.
 * - Autosaves to the on-device journal 800 ms after typing stops ("Saved on
 *   this device", aria-live). A new entry gets its id on the first save;
 *   without `entryId`, a story prompt resumes the student's latest draft for
 *   that prompt. On /journal/new the URL becomes /journal/<id> once saved.
 * - "Get notes on my writing": instant offline notes first; then, when AI
 *   notes are on in Settings, POST /api/feedback while the real steps tick. Any
 *   answer but a valid 200 keeps the instant notes and shows the API's message.
 *   Notes are saved into the entry.
 * - Notes view: the draft as text with pen marks (double underline, loop,
 *   caret) linked to the notes; notes sit in a right column when the editor is
 *   at least 880px wide, else in a list under the draft. The student's writing
 *   is never changed.
 */
export interface WritingPromptInput {
  id: string;
  kind: string;
  prompt: string;
  minWords: number;
  maxWords: number;
  tips: string[];
}

export interface WritingEditorProps {
  storySlug?: string;
  storyTitle?: string;
  prompt: WritingPromptInput;
  /** Vocabulary words to encourage (chips tick when used). */
  vocabulary: string[];
  /** Existing journal entry to edit; a new id is created on first save when absent. */
  entryId?: string;
  gradeBand: '7-8' | '9-10';
  /** 'inline' inside the reader, 'page' on /journal/[id]. */
  variant?: 'inline' | 'page';
}

const AUTOSAVE_MS = 800;

/** Entries deleted in this tab: a late autosave must never bring one back. */
const deletedEntries = new Set<string>();

/** Call before dispatching `deleteEntry`, so an editor still on screen stops saving it. */
export function markEntryDeleted(id: string): void {
  deletedEntries.add(id);
}
const selectAiFeedback = (s: LocalState) => s.prefs.aiFeedback;

export function WritingEditor(props: WritingEditorProps) {
  // The draft comes from this device: render an empty editor on the server,
  // then start over from the stored entry once the store is readable.
  const hydrated = useHydrated();
  return <EditorBody key={hydrated ? 'live' : 'server'} live={hydrated} {...props} />;
}

function resolveEntry(live: boolean, entryId: string | undefined, storySlug: string | undefined, promptText: string): { id: string; entry: JournalEntry | null } {
  if (!live) return { id: entryId ?? '', entry: null };
  const journal = getLocalState().journal;
  const entry = entryId ? (getOwn(journal, entryId) ?? null) : findResumableEntry(journal, storySlug, promptText);
  return { id: entry?.id ?? entryId ?? newEntryId(), entry };
}

function celebrate(events: LocalEvents, minWords: number) {
  const parts: string[] = [];
  if (events.xpGained > 0) parts.push(`Your entry reached ${minWords} words. +${events.xpGained} XP.`);
  for (const id of events.newBadges) {
    const badge = BADGES.find((b) => b.id === id);
    if (badge) parts.push(`New stamp: ${badge.name}.`);
  }
  if (parts.length > 0) toast({ message: parts.join(' ') });
}

function EditorBody({ live, storySlug, storyTitle, prompt, vocabulary, entryId, gradeBand, variant = 'inline' }: WritingEditorProps & { live: boolean }) {
  const ids = useId();
  const [start] = useState(() => resolveEntry(live, entryId, storySlug, prompt.prompt));
  const id = start.id;
  const [body, setBody] = useState(start.entry?.body ?? '');
  const [saved, setSaved] = useState(Boolean(start.entry));
  const [typed, setTyped] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(start.entry?.feedback ?? null);
  // The text the notes were written for (stored notes count only if the word count still matches).
  const [feedbackFor, setFeedbackFor] = useState<string | null>(() =>
    start.entry?.feedback && countWords(start.entry.body) === start.entry.feedback.stats.words ? start.entry.body : null,
  );
  const [mode, setMode] = useState<'write' | 'notes'>('write');
  const [hidden, setHidden] = useState(false);
  const [animateMarks, setAnimateMarks] = useState(false);
  const [stepsDone, setStepsDone] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const aiOn = useLocal(selectAiFeedback);
  const persistent = usePersistent();

  const exists = useRef(Boolean(start.entry));
  const pending = useRef<string | null>(null);
  const latestBody = useRef(body);
  const timer = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const focusDraft = useRef(false);
  const draftBox = useRef<HTMLDivElement>(null);

  const target = wordTarget(prompt);
  const kind = toJournalKind(prompt.kind);
  const words = countWords(body);
  const used = useMemo(() => new Set(findUsedVocabulary(body, vocabulary)), [body, vocabulary]);
  const notes = useMemo(() => (feedback ? feedbackNotes(feedback) : []), [feedback]);
  const stale = feedback !== null && feedbackFor !== body;
  const marks = useMemo(() => (feedback && !stale ? planMarks(body, notes) : []), [feedback, stale, body, notes]);
  const H = variant === 'page' ? 'h2' : 'h3';

  function save(text: string, nextFeedback?: WritingFeedback | null) {
    if (!live || deletedEntries.has(id) || (!exists.current && !text.trim())) return;
    const events = dispatch({
      type: 'saveEntry',
      entry: {
        id,
        ...(storySlug ? { storySlug: storySlug.slice(0, 200) } : {}),
        ...(storyTitle ? { storyTitle: storyTitle.slice(0, 300) } : {}),
        promptKind: kind,
        prompt: prompt.prompt.slice(0, 1000),
        body: text,
        ...(nextFeedback !== undefined ? { feedback: nextFeedback } : {}),
      },
      minWords: target.min,
    });
    const created = !exists.current;
    exists.current = true;
    setSaved(true);
    celebrate(events, target.min);
    if (created && variant === 'page' && window.location.pathname.startsWith('/journal/new')) {
      window.history.replaceState(window.history.state, '', `/journal/${encodeURIComponent(id)}`);
    }
  }

  function flush() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const text = pending.current;
    pending.current = null;
    if (text !== null) save(text);
  }

  // Save what's pending when the editor goes away or the page is hidden.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    const onHide = () => flushRef.current();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flushRef.current();
      abort.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!focusDraft.current) return;
    focusDraft.current = false;
    const textarea = draftBox.current?.querySelector('textarea');
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, [mode]);

  function onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const text = event.target.value;
    setBody(text);
    setTyped(true);
    latestBody.current = text;
    pending.current = text;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, AUTOSAVE_MS);
  }

  async function getNotes() {
    flush();
    const text = body;
    if (!text.trim()) return;
    abort.current?.abort();
    const input: FeedbackInput = {
      prompt: prompt.prompt,
      text,
      gradeBand,
      vocabulary,
      minWords: target.min,
      ...(target.max !== null ? { maxWords: target.max } : {}),
      promptKind: kind,
    };
    // Instant, offline notes first (SPEC §6).
    const instant = heuristicFeedback(input);
    setFeedback(instant);
    setFeedbackFor(text);
    setMode('notes');
    setHidden(false);
    setAnimateMarks(true);
    setMessage(null);
    save(text, instant);

    if (!getLocalState().prefs.aiFeedback) return;
    if (text.length > AI_MAX_CHARS) {
      setMessage('AI notes work on up to 6,000 characters of writing, so these are your instant notes.');
      return;
    }
    if (countWords(text) < AI_MIN_WORDS) {
      setMessage('Write a few sentences first, then ask again for AI notes.');
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    // The real steps: the first two run here and now; the other two finish with the request.
    computeWritingStats(text);
    setStepsDone(1);
    findUsedVocabulary(text, vocabulary);
    setStepsDone(2);
    if ((await siteHasAi()) === false) {
      if (controller.signal.aborted) return;
      abort.current = null;
      setStepsDone(null);
      setMessage(NOT_ON_SITE_MESSAGE);
      return;
    }
    if (controller.signal.aborted) return;
    const outcome = await requestAiFeedback(input, { signal: controller.signal, onResponse: () => setStepsDone(3) });
    if (controller.signal.aborted) return;
    abort.current = null;
    if (outcome.ok) {
      setStepsDone(4);
      setFeedback(outcome.feedback);
      setAnimateMarks(true);
      save(latestBody.current, outcome.feedback);
    } else {
      setMessage(outcome.message);
    }
    setStepsDone(null);
  }

  function keepWriting() {
    focusDraft.current = true;
    setMode('write');
    setAnimateMarks(false);
  }

  const showNotesView = mode === 'notes' && feedback !== null && !stale;
  const state = targetState(words, target);
  const statusText = saved ? (persistent === false ? 'Kept for this visit only. This browser mode can’t save.' : 'Saved on this device') : '';
  const aiText =
    aiOn === false ? (
      <>
        Notes are written on this device. AI notes are off in <Link href="/settings">Settings</Link>.
      </>
    ) : (
      'To write AI notes, Wiege sends your writing, the prompt, your grade and the story’s words. Nothing is stored.'
    );
  const noteId = (key: string) => `${ids}-note-${key}`;

  return (
    <div className="@container/editor" data-variant={variant}>
      <div className="grid gap-10 @min-[880px]/editor:grid-cols-[minmax(0,1fr)_288px] @min-[880px]/editor:gap-12 @min-[1040px]/editor:grid-cols-[minmax(0,1fr)_312px]">
        <div className="grid min-w-0 content-start gap-5">
          <p id={`${ids}-prompt`} className="type-question text-ink">
            {prompt.prompt}
          </p>
          {prompt.tips.length > 0 ? (
            <details className="group -mt-2">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-small font-bold text-ink underline decoration-2 underline-offset-[5px] hover:decoration-[3px] [&::-webkit-details-marker]:hidden">
                Tips for this prompt
                <IconChevronDown size={18} className="transition-transform duration-160 group-open:rotate-180" />
              </summary>
              <ul className="mt-2 grid max-w-[36em] list-disc gap-1.5 pl-5 text-nav leading-[1.5] text-ink-2 marker:text-ink-3">
                {prompt.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div ref={draftBox} className="grid gap-3">
            {showNotesView ? (
              <MarkedDraft body={body} marks={marks} noteId={noteId} hidden={hidden} animate={animateMarks} scope={id} />
            ) : (
              <Textarea
                label="Your writing"
                hideLabel
                tone="draft"
                rows={8}
                value={body}
                onChange={onChange}
                onBlur={flush}
                aria-describedby={`${ids}-prompt ${ids}-count`}
                textareaClassName="min-h-[calc(8lh+34px)] max-h-[75svh] resize-none [field-sizing:content]"
                placeholder="Start writing here…"
              />
            )}
            <div className="flex max-w-[36em] flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <p id={`${ids}-count`} className="inline-flex items-center gap-2 text-small text-ink-2">
                <span>
                  <b className="num font-extrabold text-ink">{words}</b> {words === 1 ? 'word' : 'words'}, {targetText(target)}
                </span>
                {state === 'in-range' ? (
                  <>
                    <MiniTick />
                    <span className="sr-only">(in the target range)</span>
                  </>
                ) : state === 'long' ? (
                  <span>(a little long)</span>
                ) : null}
              </p>
              <p role="status" className="min-h-[22px] text-caption text-ink-3">
                {statusText}
              </p>
            </div>
            {vocabulary.length > 0 ? (
              <div className="grid max-w-[36em] gap-2">
                <p id={`${ids}-chips`} className="text-caption text-ink-3">
                  Try to use these story words
                </p>
                <ul aria-labelledby={`${ids}-chips`} className="flex flex-wrap gap-2">
                  {vocabulary.map((word) => (
                    <li key={word}>
                      <VocabChip word={word} used={used.has(word)} animate={typed} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="grid max-w-[36em] gap-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {showNotesView ? (
                <>
                  <Button variant="secondary" onClick={keepWriting} className="max-md:w-full">
                    Keep writing
                  </Button>
                  <Button variant="ghost" onClick={() => setHidden((h) => !h)}>
                    {hidden ? 'Show notes' : 'Hide notes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={getNotes}
                    disabled={words === 0 || stepsDone !== null}
                    loading={stepsDone !== null}
                    loadingLabel="Checking…"
                    aria-describedby={`${ids}-ai`}
                    className="max-md:w-full"
                  >
                    Get notes on my writing
                  </Button>
                  {feedback && !stale ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setAnimateMarks(false);
                        setHidden(false);
                        setMode('notes');
                      }}
                    >
                      Show notes on my draft
                    </Button>
                  ) : null}
                </>
              )}
            </div>
            {words === 0 && !showNotesView ? <p className="text-caption text-ink-2">Write something first, then ask for notes.</p> : null}
            <p id={`${ids}-ai`} className="text-caption text-ink-3">
              {aiText}
            </p>
          </div>
        </div>

        {feedback ? (
          <FeedbackPanel
            feedback={feedback}
            notes={notes}
            marks={marks}
            idPrefix={`${ids}-note`}
            headingId={`${ids}-notes`}
            headingLevel={H}
            stale={stale}
            hidden={hidden && showNotesView}
            stepsDone={stepsDone}
            message={message}
            className="min-w-0"
          />
        ) : null}
      </div>
    </div>
  );
}
