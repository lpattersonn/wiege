import type { ReactNode } from 'react';

import { Folio, FolioLeft, FolioMain, FolioMargin, PageContainer, Section, SectionHead } from '@/components/layout/PageContainer';
import { MarkedWord } from '@/components/pen/MasteryMark';
import { MiniTick, NoteMarkIcon, ProgressLine } from '@/components/pen/marks';
import { Caret, Cross, Ring, Tick } from '@/components/pen/PenMark';
import { VocabChip } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';
import { MetaItem, MetaMinutes, MetaRow } from '@/components/ui/MetaRow';

import type { LessonTour, TourQuestion, TourWrite } from './lesson-tour';
import { PenNote, QuotedText } from './PenNote';

/**
 * "Every story is a short lesson" (DESIGN §12.1): a real sequence, Read →
 * Check → Write, on the same practice story as the hero. Static server HTML:
 * these are pictures of the lesson, not controls, so nothing here pretends to
 * be clickable (no buttons, no fields). Step numbers and titles sit in the
 * folio's left margin; notes sit in the right margin (inline below 1024px).
 */
export function HowItWorks({ tour, storyTitle }: { tour: LessonTour; storyTitle: string }) {
  const [easy, hard] = tour.levels;
  return (
    <Section id="how" rule labelledBy="how-title">
      <PageContainer>
        <SectionHead
          id="how-title"
          inFolio
          title="Every story is a short lesson."
          lede={
            <>
              Read it at your grade, tap what you don’t know, check you got it, then write back. Here’s “{storyTitle}” from the top of this page, as a
              lesson.
            </>
          }
        />
        <div className="grid gap-16 lg:gap-20">
          <Step
            n={1}
            title="Read"
            caption="Every story comes at two reading levels. Switch any time, even halfway through."
            note={
              easy && hard ? (
                <PenNote title="Same facts, two levels.">
                  <p>
                    {hard.label} uses longer sentences: about <span className="num font-bold">{hard.wordsPerSentence}</span> words each, against{' '}
                    <span className="num font-bold">{easy.wordsPerSentence}</span> at {easy.label}.
                  </p>
                </PenNote>
              ) : null
            }
          >
            <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
              {tour.levels.map((level) => (
                <li key={level.band} className="rounded-paper border border-line-soft p-5 md:p-6">
                  <p className="text-small font-bold text-ink">{level.label}</p>
                  <p className="mt-3 font-title text-[22px] leading-[1.18] font-bold text-balance lg:text-[24px]">{level.title}</p>
                  <p className="mt-3 font-read text-choice leading-normal text-ink-read">{level.opening}</p>
                  <MetaRow className="mt-4">
                    <MetaMinutes minutes={level.minutes} />
                    <MetaItem>
                      <span>
                        <span className="num">{level.words}</span> words
                      </span>
                    </MetaItem>
                  </MetaRow>
                </li>
              ))}
            </ul>
          </Step>

          {tour.question ? <CheckStep question={tour.question} /> : null}
          {tour.write ? <WriteStep write={tour.write} /> : null}
        </div>
      </PageContainer>
    </Section>
  );
}

function Step({ n, title, caption, note, children }: { n: number; title: string; caption: string; note?: ReactNode; children: ReactNode }) {
  return (
    <Folio>
      <FolioLeft>
        <h3 className="flex items-end gap-4 xl:block">
          <span className="block type-numeral-l">{n}</span>
          <span className="block font-title text-[34px] leading-none font-bold xl:mt-3">{title}</span>
        </h3>
        <p className="mt-3 max-w-[32ch] text-nav leading-normal text-ink-2 xl:max-w-[28ch]">{caption}</p>
      </FolioLeft>
      <FolioMain>{children}</FolioMain>
      <FolioMargin>{note}</FolioMargin>
    </Folio>
  );
}

function CheckStep({ question: q }: { question: TourQuestion }) {
  const scope = `landing-q${q.number}`;
  return (
    <Step
      n={2}
      title="Check"
      caption={`${q.total} questions, one at a time. A wrong answer is a first try, not a fail.`}
      note={
        <PenNote title="Got it on the second try.">
          <p className="leading-[26px]">{q.explanation}</p>
        </PenNote>
      }
    >
      <div className="flex items-center gap-4 text-small font-bold text-ink-2">
        <p>
          Question <span className="num">{q.number}</span> of <span className="num">{q.total}</span>
        </p>
        <ProgressLine value={(q.number - 1) / q.total} width={200} seed={q.number} className="max-w-[40%]" />
      </div>
      <p className="mt-4 type-question">{q.question}</p>
      <ol aria-label="Answer choices" className="mt-6 grid max-w-[36em] gap-3">
        {q.choices.map((choice) => {
          const right = choice.state === 'right';
          const wrong = choice.state === 'first-try';
          return (
            <li
              key={choice.letter}
              className={cx(
                'relative grid min-h-[60px] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-4 rounded-control bg-paper type-choice text-ink',
                right ? 'border-2 border-ink px-[15.5px] py-[11.5px]' : 'border-[1.5px] px-4 py-3',
                wrong ? 'hatch-strip overflow-hidden border-dashed border-line-control' : !right && 'border-line-control',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'relative grid size-9 place-items-center rounded-pill border-[1.5px] font-ui text-nav leading-none font-extrabold',
                  right || wrong ? 'border-transparent' : 'border-line-control',
                )}
              >
                {choice.letter}
                {right ? <Ring word={choice.letter} scope={scope} /> : null}
                {wrong ? <Cross word={choice.letter} scope={scope} /> : null}
              </span>
              <span className="min-w-0">
                {right || wrong ? (
                  <span className="mb-1 block font-ui text-caption leading-[1.2] font-bold text-ink">{right ? 'Right answer' : 'Your first try'}</span>
                ) : null}
                <span className={cx(right && 'font-semibold', wrong && 'text-ink-2 line-through decoration-[1.5px]')}>{choice.text}</span>
                {wrong ? <span className="sr-only"> Not correct.</span> : null}
              </span>
              <span className="flex items-center" aria-hidden="true">
                {right ? (
                  <span className="relative block h-[26px] w-[30px]">
                    <Tick />
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </Step>
  );
}

const NOTE_ICON = { loop: 'loop', double: 'double', caret: 'caret' } as const;
const CHECKED_STEPS = ['Counted sentences', 'Checked your vocabulary words', 'Read for ideas', 'Wrote your notes'];

function WriteStep({ write }: { write: TourWrite }) {
  return (
    <Step
      n={3}
      title="Write"
      caption="A short prompt, then notes on what’s working. Your writing stays in your journal, on this device."
      note={
        <PenNote title="Notes on your draft">
          <ul className="grid gap-5">
            {write.notes.map((note, i) => (
              <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3">
                <NoteMarkIcon kind={NOTE_ICON[note.mark]} className="mt-1.5" />
                <p className="text-nav leading-normal">
                  <span className="mb-0.5 block font-title text-[22px] leading-[1.1] font-bold">{note.kind}</span>
                  <QuotedText text={note.text} />
                </p>
              </li>
            ))}
          </ul>
        </PenNote>
      }
    >
      <p className="type-question">{write.prompt}</p>
      <p className="mt-6 text-caption font-bold text-ink-3">Example draft</p>
      <div className="mt-2 max-w-[36em] rounded-control border-[1.5px] border-line-control px-4 pt-4 pb-3 md:px-5">
        <p className="font-read text-[19px] leading-[1.9] text-ink-read md:text-[20px]">
          {write.draft.map((part, i) =>
            part.kind === 'text' ? (
              <span key={i}>{part.text}</span>
            ) : part.kind === 'caret' ? (
              <span key={i} aria-hidden="true" className="relative inline-block h-[1em] w-0">
                <Caret />
              </span>
            ) : (
              <MarkedWord key={i} word={part.text} mark={part.mark} font="read" context="read" scope="landing-draft" className="leading-[1.2]" />
            ),
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-3 text-small text-ink-2">
          <ul aria-label="Words from the story" className="flex flex-wrap gap-2">
            {write.vocabulary.map((v) => (
              <li key={v.word}>
                <VocabChip word={v.word} used={v.used} />
              </li>
            ))}
          </ul>
          <p>
            <b className="num font-bold text-ink">{write.words}</b> words, aim for <span className="num">{write.minWords}</span> to{' '}
            <span className="num">{write.maxWords}</span>
          </p>
        </div>
      </div>
      <ul aria-label="What Wiege checked" className="mt-4 grid gap-1 text-small text-ink-2">
        {CHECKED_STEPS.map((step) => (
          <li key={step} className="flex items-center gap-2">
            <MiniTick />
            {step}
          </li>
        ))}
      </ul>
    </Step>
  );
}
