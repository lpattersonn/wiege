import 'server-only';

import { aiAvailable } from '@/lib/ai/client';
import type { CategorySlug } from '@/lib/categories';
import { scanLesson } from '@/lib/news/safety';
import { claudeLesson } from '@/lib/literacy/claude';
import { heuristicLesson } from '@/lib/literacy/heuristic';
import { lessonReadingGrade, levelText } from '@/lib/literacy/readability';
import { GRADE_BANDS, LessonContent, lessonContentProblems, type VocabularyItem } from '@/lib/literacy/types';
import { containsWord } from '@/lib/literacy/word-forms';

/**
 * Lesson generation entry point (SPEC §5 step 5, §6): Claude when available,
 * the offline heuristic engine otherwise or whenever the Claude result is
 * refused, invalid or fails the kid-safety re-scan. AI problems never reach
 * the caller. It throws only if even the heuristic lesson is unusable, which
 * the ingest treats as `failed`.
 */

export type LessonSourceInput = {
  title: string;
  excerpt: string;
  /** Article text for the model's context only: never stored or shown. */
  fullText?: string;
  category: CategorySlug;
  sourceName: string;
  url: string;
};

export interface GeneratedLesson {
  content: LessonContent;
  generator: 'claude' | 'heuristic';
  model: string | null;
  /** Flesch–Kincaid grade of the Grade 7–8 retelling. */
  readingGrade: number;
}

export interface GenerateLessonOptions {
  /** Headlines of other stories in the same run (distractors for the heuristic quiz). */
  siblingTitles?: string[];
  /** Per-call time limit for the Claude request, e.g. to fit a serverless ingest budget. */
  timeoutMs?: number;
}

export async function generateLesson(input: LessonSourceInput, opts?: GenerateLessonOptions): Promise<GeneratedLesson> {
  if (aiAvailable()) {
    const result = await claudeLesson(
      { title: input.title, excerpt: input.excerpt, fullText: input.fullText, category: input.category, sourceName: input.sourceName },
      { timeoutMs: opts?.timeoutMs },
    );
    if (result.ok) {
      const content = normalizeLesson(result.value, input.url);
      const problems = lessonContentProblems(content);
      const safety = scanLesson(content);
      if (problems.length === 0 && safety.safe) {
        return { content, generator: 'claude', model: result.model, readingGrade: lessonReadingGrade(content) };
      }
      console.warn(
        `[literacy] Claude lesson for ${input.url} not used: ${problems.length > 0 ? problems.join('; ') : `safety re-scan: ${safety.reasons.join(', ')}`}`,
      );
    }
  }

  const content = heuristicLesson(input, { siblingTitles: opts?.siblingTitles });
  const problems = lessonContentProblems(content);
  if (problems.length > 0) throw new Error(`Heuristic lesson for ${input.url} is incomplete: ${problems.join('; ')}`);
  const safety = scanLesson(content);
  if (!safety.safe) throw new Error(`Heuristic lesson for ${input.url} failed the safety re-scan: ${safety.reasons.join(', ')}`);
  return { content, generator: 'heuristic', model: null, readingGrade: lessonReadingGrade(content) };
}

// --- normalisation of model output --------------------------------------------------

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Rotates the choices so the correct answer sits at a position derived from `seed` (no positional bias). */
function placeAnswer<T>(choices: readonly T[], answerIndex: number, seed: number): { choices: T[]; answerIndex: number } {
  if (choices.length === 0 || answerIndex < 0 || answerIndex >= choices.length) return { choices: [...choices], answerIndex };
  const target = seed % choices.length;
  const shift = (target - answerIndex + choices.length) % choices.length;
  const rotated = choices.map((_, i) => choices[(i - shift + choices.length) % choices.length]);
  return { choices: rotated, answerIndex: target };
}

function normalizeVocabulary(items: readonly VocabularyItem[], texts: Record<(typeof GRADE_BANDS)[number], string>): VocabularyItem[] {
  const seen = new Set<string>();
  const cleaned = items
    .map((item) => ({
      ...item,
      word: tidy(item.word),
      partOfSpeech: tidy(item.partOfSpeech).toLowerCase(),
      definition: tidy(item.definition),
      example: tidy(item.example),
    }))
    .filter((item) => {
      const key = item.word.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const located = cleaned
    .map((item) => {
      const inJunior = containsWord(texts['7-8'], item.word);
      const inSenior = containsWord(texts['9-10'], item.word);
      const band: VocabularyItem['band'] = inJunior && inSenior ? 'both' : inJunior ? '7-8' : inSenior ? '9-10' : item.band;
      return { item: { ...item, band }, found: inJunior || inSenior };
    });
  const present = located.filter((l) => l.found).map((l) => l.item);
  // Keep words the reader can highlight; if the model's forms drifted too far, keep its list rather than lose the lesson.
  return (present.length >= 5 ? present : located.map((l) => l.item)).slice(0, 8);
}

/**
 * Tidies a Claude lesson: trims text, gives quiz and prompt ids a stable form,
 * whole-number word ranges, vocabulary bands that match where each word
 * actually appears, and answer positions spread deterministically.
 */
export function normalizeLesson(content: LessonContent, seedText: string): LessonContent {
  const levels = {
    '7-8': {
      title: tidy(content.levels['7-8'].title).replace(/\.$/, ''),
      paragraphs: content.levels['7-8'].paragraphs.map(tidy).filter(Boolean),
    },
    '9-10': {
      title: tidy(content.levels['9-10'].title).replace(/\.$/, ''),
      paragraphs: content.levels['9-10'].paragraphs.map(tidy).filter(Boolean),
    },
  };
  const texts = { '7-8': levelText(levels['7-8']), '9-10': levelText(levels['9-10']) };
  return {
    keyIdea: tidy(content.keyIdea),
    levels,
    vocabulary: normalizeVocabulary(content.vocabulary, texts),
    quiz: content.quiz.map((q, i) => {
      const placed = placeAnswer(q.choices.map(tidy), q.answerIndex, fnv1a(`${seedText}#q${i + 1}`));
      return { ...q, id: `q${i + 1}`, question: tidy(q.question), explanation: tidy(q.explanation), ...placed };
    }),
    writingPrompts: content.writingPrompts.map((p, i) => {
      const minWords = Math.max(1, Math.round(p.minWords));
      return {
        ...p,
        id: `p${i + 1}`,
        prompt: tidy(p.prompt),
        tips: p.tips.map(tidy).filter(Boolean),
        minWords,
        maxWords: Math.max(minWords, Math.round(p.maxWords)),
      };
    }),
    discussion: content.discussion.map(tidy).filter(Boolean),
  };
}
