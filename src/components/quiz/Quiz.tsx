'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';

import { Folio, FolioLeft, FolioMain, FolioMargin } from '@/components/layout/PageContainer';
import { useReadRecord } from '@/components/local/hooks';
import { Bracket } from '@/components/pen/marks';
import { Cross, Tick, Underline } from '@/components/pen/PenMark';
import { rangeFromOffsets, rectsWithin, scrollBehavior } from '@/components/reader/dom';
import { OVERLAY_ID, READER_ID } from '@/components/reader/ids';
import { levelParagraphs, useReader } from '@/components/reader/ReaderRoot';
import type { Evidence } from '@/components/reader/text';
import { Button, LinkButton } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { QuizChoices } from '@/components/ui/QuizChoices';
import { QuizOption } from '@/components/ui/QuizOption';
import { StampGrid, StampTile } from '@/components/ui/StampTile';
import { BADGES, type BadgeId } from '@/lib/progress/badges';
import type { GradeBand } from '@/lib/literacy/types';
import type { LocalEvents } from '@/lib/local/reducers';
import { dispatch } from '@/lib/local/store';

import {
  feedbackHeadline,
  firstAnswers,
  firstTryScore,
  isSolved,
  nextQuestion,
  optionDisabled,
  optionState,
  pick,
  startQuiz,
  type QuizProgress,
} from './quiz-logic';

/**
 * "Check your understanding" (SPEC §8, DESIGN §11.10): one question at a
 * time as a radiogroup of choice cards; a pick is an answer, shown by shape
 * (pen tick or cross, "Right answer" / "Your first try" labels), never by
 * colour. The explanation note sits in the margin from 1024px and under the
 * actions below that; it is announced politely. "Show me where it says so"
 * underlines the evidence in the story with the pen. Finishing submits the
 * quiz (which also completes the story) and shows the score, the XP and any
 * new stamp. Coming back shows the saved result, with a way to try again.
 */

export interface QuizItem {
  id: string;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  /** Where the explanation's quote is in each level's text (null: it quotes nothing from the story). */
  evidence: Record<GradeBand, Evidence | null>;
}

interface Finished {
  score: number;
  total: number;
  answers: number[];
  /** Picks per question (fresh runs only), to say "on the second try". */
  picks?: number[][];
  events?: LocalEvents;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const noopSubscribe = () => () => {};
const getOverlay = () => document.getElementById(OVERLAY_ID);
const noOverlay = () => null;

export function Quiz({ questions, heading, writeHref }: { questions: QuizItem[]; heading: ReactNode; writeHref: string }) {
  const { story, level } = useReader();
  const record = useReadRecord(story.slug);
  const [progress, setProgress] = useState<QuizProgress>(() => startQuiz(questions.length));
  const [lastPick, setLastPick] = useState<number | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [evidence, setEvidence] = useState<{ question: string; range: Range; serial: number } | null>(null);
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);
  const questionRef = useRef<HTMLParagraphElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef<'question' | 'summary' | null>(null);
  const baseId = useId();

  const total = questions.length;
  const q = questions[Math.min(progress.index, total - 1)];
  const picks = progress.picks[progress.index] ?? [];
  const solved = q ? isSolved(picks, q.answerIndex) : false;
  const started = progress.picks.some((p) => p.length > 0);
  const stored = record?.quiz;
  const showStored = !finished && !retaking && !started && stored && stored.total === total;
  const summary: Finished | null = finished ?? (showStored ? { score: stored.score, total: stored.total, answers: stored.answers } : null);

  useEffect(() => {
    const target = focusNext.current === 'question' ? questionRef.current : focusNext.current === 'summary' ? summaryRef.current : null;
    focusNext.current = null;
    target?.focus({ preventScroll: false });
  }, [progress.index, finished, retaking]);

  if (!q) return null;

  function onPick(choice: number) {
    if (optionDisabled(picks, q.answerIndex, choice)) return;
    setProgress((p) => pick(p, q.answerIndex, choice));
    setLastPick(choice);
  }

  function onNext() {
    setEvidence(null);
    setEvidenceNote(null);
    setLastPick(null);
    if (progress.index < total - 1) {
      focusNext.current = 'question';
      setProgress(nextQuestion(progress));
      return;
    }
    const answers = firstAnswers(progress);
    const score = firstTryScore(
      answers,
      questions.map((x) => x.answerIndex),
    );
    const events = dispatch({ type: 'submitQuiz', slug: story.slug, title: story.titles[level], category: story.category, level, score, total, answers });
    focusNext.current = 'summary';
    setFinished({ score, total, answers, picks: progress.picks, events });
  }

  function onRetake() {
    focusNext.current = 'question';
    setFinished(null);
    setRetaking(true);
    setProgress(startQuiz(total));
    setLastPick(null);
  }

  function showEvidence() {
    const where = q.evidence[level];
    const root = document.getElementById(READER_ID);
    const paragraph = where && root ? levelParagraphs(root, level)[where.para] : null;
    const range = paragraph && where ? rangeFromOffsets(paragraph, where.start, where.end) : null;
    if (!range || !paragraph || !where) return;
    setEvidence({ question: q.id, range, serial: Date.now() });
    const quoted = (paragraph.textContent ?? '').slice(where.start, where.end);
    setEvidenceNote(`It’s underlined in paragraph ${where.para + 1}: “${quoted}”.`);
    const box = range.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + box.top - window.innerHeight * 0.35, behavior: scrollBehavior() });
  }

  const headline = feedbackHeadline(picks, q.answerIndex);
  const canShowWhere = Boolean(q.evidence[level]) && picks.length > 0;

  return (
    <Folio>
      <FolioLeft>{heading}</FolioLeft>
      <FolioMain>
        {summary ? (
          <QuizSummary summary={summary} questions={questions} fresh={Boolean(finished)} headingRef={summaryRef} onRetake={onRetake} writeHref={writeHref} />
        ) : (
          <>
            <ProgressBar value={progress.index + (solved ? 1 : 0)} max={total} label={`Question ${progress.index + 1} of ${total}`} name="Quiz progress" width={200} />
            <p id={`${baseId}-q`} ref={questionRef} tabIndex={-1} className="mt-6 type-question outline-offset-4">
              {q.question}
            </p>
            <QuizChoices labelledBy={`${baseId}-q`} className="mt-6 max-w-[40em]">
              {q.choices.map((choice, i) => {
                const state = optionState(picks, q.answerIndex, i);
                return (
                  <QuizOption
                    key={`${q.id}-${i}`}
                    letter={LETTERS[i] ?? String(i + 1)}
                    state={state}
                    checked={picks.length > 0 && picks[picks.length - 1] === i}
                    disabled={optionDisabled(picks, q.answerIndex, i)}
                    animate={lastPick === i}
                    aside={state === 'first-try' && lastPick === i}
                    scope={`${story.slug}-${q.id}`}
                    onClick={() => onPick(i)}
                  >
                    {choice}
                  </QuizOption>
                );
              })}
            </QuizChoices>
            <div className="mt-8 flex min-h-12 flex-wrap items-center gap-x-8 gap-y-3">
              {solved ? <Button onClick={onNext}>{progress.index < total - 1 ? 'Next question' : 'See my score'}</Button> : null}
              {canShowWhere ? (
                <Button variant="ghost" onClick={showEvidence}>
                  Show me where it says so
                </Button>
              ) : null}
              {!solved && !canShowWhere ? <p className="text-small text-ink-3">Pick the answer you think is right.</p> : null}
            </div>
          </>
        )}
      </FolioMain>
      <FolioMargin>
        <div role="status" aria-live="polite" aria-atomic="true" className="lg:mt-16">
          {!summary && headline ? (
            <div key={`${q.id}-${picks.length}`} className="fade-in relative max-w-[42ch] pt-0.5 pb-1 pl-[26px] text-ui leading-normal text-ink">
              <Bracket />
              <p className="font-bold">{headline}</p>
              {solved ? <p className="mt-2">{q.explanation}</p> : <p className="mt-2 text-ink-2">Look back at the story, then pick again.</p>}
              {evidenceNote && evidence?.question === q.id ? <p className="mt-2 text-small leading-[22px] text-ink-2">{evidenceNote}</p> : null}
            </div>
          ) : null}
        </div>
      </FolioMargin>
      {evidence && evidence.question === q.id && !summary ? <EvidenceMark range={evidence.range} serial={evidence.serial} /> : null}
    </Folio>
  );
}

/** The pen underline under the quoted evidence, one stroke per line, drawn in the story's overlay. */
function EvidenceMark({ range, serial }: { range: Range; serial: number }) {
  const overlay = useSyncExternalStore(noopSubscribe, getOverlay, noOverlay);
  const [lines, setLines] = useState<ReturnType<typeof rectsWithin>>([]);
  useEffect(() => {
    if (!overlay) return;
    const observer = new ResizeObserver(() => setLines(rectsWithin(range, overlay)));
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [overlay, range]);
  if (!overlay) return null;
  return createPortal(
    <>
      {lines.map((line, i) => (
        <span key={`${serial}-${i}`} className="absolute block" style={{ left: line.left, top: line.top, width: line.width, height: line.height, fontSize: line.height / 1.2 }}>
          <Underline word={`evidence-${i}`} scope={String(serial)} scale={1.05} animate delay={i * 180} />
        </span>
      ))}
    </>,
    overlay,
  );
}

function QuizSummary({
  summary,
  questions,
  fresh,
  headingRef,
  onRetake,
  writeHref,
}: {
  summary: Finished;
  questions: QuizItem[];
  fresh: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  onRetake: () => void;
  writeHref: string;
}) {
  const events = summary.events;
  const stamps = (events?.newBadges ?? []).map((id) => BADGES.find((b) => b.id === id)).filter((b): b is { id: BadgeId; name: string; hint: string } => Boolean(b));
  const xp = events?.xpGained ?? 0;
  const rows = questions.map((question, i) => {
    const first = summary.answers[i];
    const right = first === question.answerIndex;
    const tries = summary.picks?.[i] ? summary.picks[i].indexOf(question.answerIndex) + 1 : 0;
    const label = right ? 'Right on your first try' : tries > 1 ? `Right on try ${tries}` : first === -1 ? 'Not answered' : 'Not right on your first try';
    return { right, label };
  });

  return (
    <div>
      <h3 ref={headingRef} tabIndex={-1} className="type-h3 outline-offset-4">
        <span className="num">{summary.score}</span> of <span className="num">{summary.total}</span> on your first try.
      </h3>
      <p className="mt-3 text-ui leading-normal text-ink-2">
        {fresh
          ? xp > 0
            ? (
                <>
                  <b className="num font-extrabold text-ink">+{xp} XP</b>. The story is marked as read.
                </>
              )
            : 'Your best score is kept. Quiz XP counts on your first go.'
          : 'You answered these before. Your best score is kept on this device.'}
        {events?.levelUp ? ` You’re now a ${events.levelUp.name}.` : null}
      </p>
      <ol className="mt-6 grid max-w-[40em] gap-2">
        {rows.map((row, i) => (
          <li key={questions[i].id} className="flex min-h-11 items-center gap-4 border-b border-line-soft pb-2 text-ui">
            <span className="relative block size-7 shrink-0" aria-hidden="true">
              {row.right ? <Tick animate={fresh} delay={fresh ? 200 + i * 160 : undefined} /> : <Cross word={`q${i}`} animate={fresh} delay={fresh ? 200 + i * 160 : undefined} />}
            </span>
            <span className="font-bold">
              Question <span className="num">{i + 1}</span>
            </span>
            <span className="text-ink-2">{row.label}</span>
          </li>
        ))}
      </ol>
      {stamps.length ? (
        <div className="mt-10">
          <h4 className="type-h4">{stamps.length === 1 ? 'New stamp' : 'New stamps'}</h4>
          <StampGrid className="mt-4">
            {stamps.map((stamp) => (
              <StampTile key={stamp.id} id={stamp.id} name={stamp.name} how={stamp.hint} earned animate />
            ))}
          </StampGrid>
        </div>
      ) : null}
      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
        <LinkButton href={writeHref}>Write about it</LinkButton>
        <Button variant="ghost" onClick={onRetake}>
          Try the questions again
        </Button>
      </div>
    </div>
  );
}
