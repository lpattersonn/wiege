import { findUsedVocabulary, heuristicFeedback } from '@/lib/literacy/feedback-core';
import { lessonReadingMinutes, levelText, textStatistics } from '@/lib/literacy/readability';
import type { GradeBand, LessonContent, WritingPromptKind } from '@/lib/literacy/types';

import { splitSentencesKeepingText } from './hero-demo';

/**
 * "Every story is a short lesson" (DESIGN §12.1, SPEC §8): the landing's
 * how-it-works sequence, built from the practice story's real lesson so every
 * number, question and note on the page is true:
 *   1 Read  — the two reading levels with their real word counts;
 *   2 Check — one real quiz question, shown after a first try and a right answer;
 *   3 Write — one real prompt, an example draft, and the notes Wiege's offline
 *             checker (heuristicFeedback) really writes for that draft.
 * Pure and isomorphic; the page renders it on the server.
 */

export interface TourLevel {
  band: GradeBand;
  label: string;
  title: string;
  /** The retelling's first sentence. */
  opening: string;
  words: number;
  wordsPerSentence: number;
  minutes: number;
}

export type ChoiceState = 'right' | 'first-try' | 'idle';

export interface TourQuestion {
  number: number;
  total: number;
  question: string;
  choices: Array<{ letter: string; text: string; state: ChoiceState }>;
  explanation: string;
}

export type DraftPart = { kind: 'text'; text: string } | { kind: 'mark'; text: string; mark: 'loop' | 'double' } | { kind: 'caret' };

export interface TourNote {
  kind: 'Working' | 'Try next';
  mark: 'loop' | 'double' | 'caret';
  text: string;
}

export interface TourWrite {
  prompt: string;
  kind: WritingPromptKind;
  minWords: number;
  maxWords: number;
  draft: DraftPart[];
  words: number;
  vocabulary: Array<{ word: string; used: boolean }>;
  notes: TourNote[];
}

export interface LessonTour {
  levels: TourLevel[];
  question: TourQuestion | null;
  write: TourWrite | null;
}

/**
 * Example drafts, written for a specific practice story and prompt. Labelled
 * "Example draft" on the page; the notes under them are computed, not written.
 */
export const EXAMPLE_DRAFTS: Readonly<Record<string, { promptId: string; text: string }>> = {
  'practice-libraries-lend-more': {
    promptId: 'p2',
    text: 'Our library should lend skateboards and helmets. A good board costs more than most kids can afford, so lots of us never get to try. If the library had a few, anyone in the community could explore the skate park for a week. Skating is also a way to meet people. The older kids already help beginners with tricks, so the boards would get used every day.',
  },
};

const LEVEL_LABEL: Record<GradeBand, string> = { '7-8': 'Grade 7–8', '9-10': 'Grade 9–10' };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function tourLevel(content: LessonContent, band: GradeBand): TourLevel {
  const level = content.levels[band];
  const stats = textStatistics(levelText(level));
  return {
    band,
    label: LEVEL_LABEL[band],
    title: level.title,
    opening: splitSentencesKeepingText(level.paragraphs[0] ?? '')[0] ?? '',
    words: stats.words,
    wordsPerSentence: Math.round(stats.avgSentenceLength),
    minutes: lessonReadingMinutes(content, band),
  };
}

/** An inference question if there is one (the most interesting to show), else the first. */
function tourQuestion(content: LessonContent): TourQuestion | null {
  const index = Math.max(
    0,
    content.quiz.findIndex((q) => q.skill === 'inference'),
  );
  const q = content.quiz[index];
  if (!q) return null;
  const firstTry = q.choices.findIndex((_, i) => i !== q.answerIndex);
  return {
    number: index + 1,
    total: content.quiz.length,
    question: q.question,
    choices: q.choices.map((text, i) => ({
      letter: LETTERS[i] ?? String(i + 1),
      text,
      state: i === q.answerIndex ? 'right' : i === firstTry ? 'first-try' : 'idle',
    })),
    explanation: q.explanation,
  };
}

/** First "quoted" phrase in a feedback note. */
export function firstQuote(note: string): string | null {
  return /"([^"]+)"/.exec(note)?.[1] ?? null;
}

/** Marks the first whole-word occurrence of each phrase; a caret after the first sentence. */
export function markDraft(text: string, marks: Array<{ phrase: string; mark: 'loop' | 'double' }>, caretAfterFirstSentence: boolean): DraftPart[] {
  type Span = { start: number; end: number; mark: 'loop' | 'double' | 'caret' };
  const spans: Span[] = [];
  for (const { phrase, mark } of marks) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').exec(text);
    if (found && !spans.some((s) => found.index < s.end && found.index + phrase.length > s.start)) {
      spans.push({ start: found.index, end: found.index + phrase.length, mark });
    }
  }
  if (caretAfterFirstSentence) {
    const end = /[.!?](?=\s)/.exec(text);
    if (end) spans.push({ start: end.index + 1, end: end.index + 1, mark: 'caret' });
  }
  spans.sort((a, b) => a.start - b.start);
  const parts: DraftPart[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) parts.push({ kind: 'text', text: text.slice(cursor, span.start) });
    parts.push(span.mark === 'caret' ? { kind: 'caret' } : { kind: 'mark', text: text.slice(span.start, span.end), mark: span.mark });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) });
  return parts;
}

function tourWrite(slug: string, content: LessonContent): TourWrite | null {
  const example = EXAMPLE_DRAFTS[slug];
  const prompt = example ? content.writingPrompts.find((p) => p.id === example.promptId) : undefined;
  if (!example || !prompt) return null;
  const vocabulary = content.vocabulary.filter((v) => v.band !== '9-10').map((v) => v.word);
  const feedback = heuristicFeedback({
    prompt: prompt.prompt,
    text: example.text,
    gradeBand: '7-8',
    vocabulary,
    minWords: prompt.minWords,
    maxWords: prompt.maxWords,
    promptKind: prompt.kind,
  });
  const used = new Set(findUsedVocabulary(example.text, vocabulary));
  // DESIGN §11.12: two "Working" notes, then at most two "Try next"; never more than four marks.
  const working = feedback.glow.slice(0, 2);
  const tryNext = feedback.grow.slice(0, 1);
  const glowMarks: Array<'loop' | 'double'> = ['loop', 'double'];
  const marks = working
    .map((note, i) => ({ phrase: firstQuote(note), mark: glowMarks[i] }))
    .filter((m): m is { phrase: string; mark: 'loop' | 'double' } => Boolean(m.phrase && !/\s/.test(m.phrase)));
  return {
    prompt: prompt.prompt,
    kind: prompt.kind,
    minWords: prompt.minWords,
    maxWords: prompt.maxWords,
    draft: markDraft(example.text, marks, tryNext.length > 0),
    words: feedback.stats.words,
    vocabulary: vocabulary.map((word) => ({ word, used: used.has(word) })),
    notes: [
      ...working.map((text, i): TourNote => ({ kind: 'Working', mark: glowMarks[i], text })),
      ...tryNext.map((text): TourNote => ({ kind: 'Try next', mark: 'caret', text })),
    ],
  };
}

export function buildLessonTour(story: { slug: string; content: LessonContent }): LessonTour {
  return {
    levels: [tourLevel(story.content, '7-8'), tourLevel(story.content, '9-10')],
    question: tourQuestion(story.content),
    write: tourWrite(story.slug, story.content),
  };
}
