'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

import { IconClose } from '@/components/glyphs/icons';
import { MarkedWord, masteryInfo } from '@/components/pen/MasteryMark';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { Flashcard, FlashcardGrades, type Grade } from '@/components/ui/Flashcard';
import { Kbd } from '@/components/ui/Kbd';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { toast } from '@/components/ui/Toast';
import { BADGES } from '@/lib/progress/badges';
import { DAILY_XP_CAPS } from '@/lib/progress/xp';
import { dispatch, getLocalState, useLocal } from '@/lib/local/store';
import { getOwn, normalizeWordKey, type LocalState, type WordEntry } from '@/lib/local/schema';

import { WordsEmpty } from './parts';
import { buildRound, countDue, nextDueSentence, practiseAnywayLabel, ROUND_SIZE, roundSummary, type RoundMode, type RoundResult } from './word-bank';

/**
 * /words/practice (DESIGN §11.19, §12.5): a flashcard round of up to 20 due
 * cards. Space flips, 1–4 grade (Again, Hard, Good, Easy → reviewWord), Esc
 * ends the round. The summary shows how many moved up, the new marks and the
 * XP earned. Full screen on mobile: the only way out is the close button.
 */

const selectWords = (s: LocalState) => s.words;
const selectTimeZone = (s: LocalState) => s.prefs.timezone;

/** Close button + page title: the practice screen's top bar. */
export function PracticeTopBar({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      {onClose ? (
        <IconButton bare label="Stop practising" icon={<IconClose />} onClick={onClose} className="-ml-2.5" />
      ) : (
        <Link
          href="/words"
          aria-label="Back to your words"
          className="-ml-2.5 inline-grid size-11 shrink-0 place-items-center rounded-pill text-ink no-underline hover:bg-sheet"
        >
          <IconClose />
        </Link>
      )}
      <h1 className="font-title text-[22px] leading-[1.15] font-bold">Practise your words</h1>
    </div>
  );
}

/** Same-size placeholder for the card while the store loads. */
export function PracticeSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-6">
      <span className="skeleton block h-6 w-60" />
      <span className="skeleton block h-[448px] rounded-card! md:h-[308px]" />
      <span className="skeleton block h-12 rounded-pill! md:w-44" />
    </div>
  );
}

function startRound(mode: RoundMode): WordEntry[] {
  return buildRound(Object.values(getLocalState().words), Date.now(), mode, Math.random);
}

/** Inside <Suspense> (it reads ?mode=any). */
export function PracticeSession() {
  const mode: RoundMode = useSearchParams().get('mode') === 'any' ? 'any' : 'due';
  const record = useLocal(selectWords);
  if (record === null) {
    return (
      <div className="grid gap-6">
        <PracticeTopBar />
        <PracticeSkeleton />
      </div>
    );
  }
  if (Object.keys(record).length === 0) {
    return (
      <div className="grid gap-6">
        <PracticeTopBar />
        <WordsEmpty />
      </div>
    );
  }
  return <RoundRunner mode={mode} />;
}

/** Remounts the round for "Practise N more". */
function RoundRunner({ mode }: { mode: RoundMode }) {
  const [round, setRound] = useState(0);
  return <Round key={`${mode}-${round}`} mode={round > 0 ? 'due' : mode} onAgain={() => setRound((n) => n + 1)} />;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

const GRADE_KEYS: Record<string, Grade> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };

function Round({ mode, onAgain }: { mode: RoundMode; onAgain: () => void }) {
  const router = useRouter();
  const ids = useId();
  const [cards, setCards] = useState<WordEntry[]>(() => startRound(mode));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [xp, setXp] = useState(0);
  const [done, setDone] = useState(false);
  const [last, setLast] = useState<RoundResult | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const focusCard = useRef(false);

  const card = cards[index];
  const total = cards.length;

  function endRound() {
    if (results.length === 0) router.push('/words');
    else setDone(true);
  }

  function flip() {
    focusCard.current = true;
    setFlipped((f) => !f);
  }

  function grade(value: Grade) {
    if (!card || !flipped) return;
    const events = dispatch({ type: 'reviewWord', word: card.word, grade: value });
    const after = getOwn(getLocalState().words, normalizeWordKey(card.word))?.box ?? card.box;
    const result: RoundResult = { word: card.word, before: card.box, after };
    setResults((r) => [...r, result]);
    setXp((x) => x + events.xpGained);
    setLast(result);
    for (const id of events.newBadges) {
      const badge = BADGES.find((b) => b.id === id);
      if (badge) toast({ message: `New stamp: ${badge.name}.` });
    }
    if (index + 1 >= total) {
      setDone(true);
    } else {
      focusCard.current = true;
      setIndex(index + 1);
      setFlipped(false);
    }
  }

  // Keyboard: Space flips (unless a control has focus and handles it), 1–4 grade, Esc ends.
  useEffect(() => {
    if (done || !card) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        endRound();
        return;
      }
      if (event.key === ' ') {
        const target = event.target as HTMLElement | null;
        if (target && target.closest('button, a, [role="button"]')) return; // native activation
        event.preventDefault();
        flip();
        return;
      }
      const g = GRADE_KEYS[event.key];
      if (g && flipped) {
        event.preventDefault();
        grade(g);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Keep focus on the card after a flip or a grade (the button that was pressed goes away).
  useEffect(() => {
    if (!focusCard.current) return;
    focusCard.current = false;
    cardRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [index, flipped]);

  useEffect(() => {
    if (done) summaryRef.current?.focus();
  }, [done]);

  if (done) {
    return <Summary results={results} xp={xp} headingRef={summaryRef} headingId={`${ids}-done`} onAgain={onAgain} />;
  }

  if (!card) {
    return <NothingDue onAnyway={() => setCards(startRound('any'))} />;
  }

  const lastInfo = last ? masteryInfo(last.after) : null;

  return (
    <div className="grid gap-6">
      <PracticeTopBar onClose={endRound} />
      <ProgressBar value={index} max={total} label={`Card ${index + 1} of ${total}`} name="Practice round progress" valueText={`Card ${index + 1} of ${total}`} width="100%" />
      <div ref={cardRef} key={card.word} className="fade-in">
        <Flashcard
          word={card.word}
          mastery={card.box}
          definition={card.definition}
          example={card.example}
          storyTitle={card.storyTitle}
          flipped={flipped}
          onFlip={flip}
          size="practice"
        />
      </div>
      <div className="grid gap-3">
        {flipped ? (
          <FlashcardGrades onGrade={grade} />
        ) : (
          <Button onClick={flip} className="max-md:w-full md:justify-self-start">
            Flip the card
          </Button>
        )}
        <p className="hidden text-caption text-ink-3 md:block">
          <Kbd>Space</Kbd> flips the card. <Kbd>1</Kbd> to <Kbd>4</Kbd> grades it. <Kbd>Esc</Kbd> ends the round.
        </p>
        <p className="text-caption text-ink-3 md:hidden">Say what it means out loud first. Then flip.</p>
      </div>
      <p role="status" className="min-h-7 text-small text-ink-2">
        {last && lastInfo ? (
          last.after > last.before ? (
            <>
              <span className="font-title text-[20px] leading-[1.2] font-bold text-ink">
                <MarkedWord key={`${last.word}-${results.length}`} word={last.word} level={last.after} animate />
              </span>{' '}
              moved up to {lastInfo.label}.
            </>
          ) : (
            <>
              <b className="font-bold text-ink">{last.word}</b> is at {lastInfo.label}. {lastInfo.level === 1 ? 'It comes back today.' : `${lastInfo.next}.`}
            </>
          )
        ) : null}
      </p>
    </div>
  );
}

function NothingDue({ onAnyway }: { onAnyway: () => void }) {
  const record = useLocal(selectWords);
  const timeZone = useLocal(selectTimeZone);
  const [now] = useState(() => Date.now());
  const words = record ? Object.values(record) : [];
  const next = timeZone ? nextDueSentence(words, now, timeZone) : null;
  return (
    <div className="grid gap-6">
      <PracticeTopBar />
      <div className="grid justify-items-center gap-4 py-16 text-center">
        <h2 className="font-title text-[26px] leading-[1.15] font-bold text-balance">Nothing to practise right now.</h2>
        <p className="max-w-[46ch] text-ui text-ink-2">{next ?? 'Save a few words from a story first.'} Words come back when they are due, so they stick.</p>
        {words.length > 0 ? (
          <Button onClick={onAnyway} className="mt-4">
            {practiseAnywayLabel(words.length)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Summary({ results, xp, headingRef, headingId, onAgain }: { results: RoundResult[]; xp: number; headingRef: RefObject<HTMLHeadingElement | null>; headingId: string; onAgain: () => void }) {
  const summary = roundSummary(results);
  const record = useLocal(selectWords);
  const [now] = useState(() => Date.now());
  const dueLeft = record ? countDue(Object.values(record), now) : 0;
  let xpLine: ReactNode;
  if (xp > 0) {
    xpLine = (
      <>
        You earned <b className="num font-extrabold text-ink">+{xp} XP</b>.
      </>
    );
  } else {
    xpLine = `You’ve had today’s ${DAILY_XP_CAPS.review ?? 20} XP for practice. Practising still helps the words stick.`;
  }
  return (
    <section aria-labelledby={headingId} className="grid gap-6">
      <PracticeTopBar />
      <div className="grid gap-6 rounded-card border-[1.5px] border-ink p-6">
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="type-h3 outline-none">
          {summary.sentence}
        </h2>
        <ul aria-label="Your words after this round" className="flex flex-wrap gap-x-7 gap-y-5 pb-2">
          {results.map((r) => {
            const info = masteryInfo(r.after);
            return (
              <li key={r.word} className="grid gap-1">
                <span className="font-title text-[28px] leading-[1.2] font-bold text-ink">
                  <MarkedWord word={r.word} level={r.after} animate={r.after > r.before} />
                </span>
                <span className="mt-1.5 text-caption text-ink-3">
                  {info.label}
                  {r.after > r.before ? <span className="sr-only"> (moved up)</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-ui text-ink-2">{xpLine}</p>
      </div>
      <div className="flex flex-wrap gap-4">
        <LinkButton href="/words" className="max-md:w-full">
          Back to your words
        </LinkButton>
        {dueLeft > 0 ? (
          <Button variant="secondary" className="max-md:w-full" onClick={onAgain}>
            {Math.min(dueLeft, ROUND_SIZE) === 1 ? 'Practise 1 more word' : `Practise ${Math.min(dueLeft, ROUND_SIZE)} more words`}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
