import { z } from 'zod';

/**
 * Literacy contracts (SPEC §6). Isomorphic.
 *
 * These schemas double as Claude structured-output schemas, so they stay within
 * what `betaZodOutputFormat` can express: closed objects only (no records),
 * no numeric minimum/maximum (not even `.int()`, which zod renders as the
 * safe-integer range) and no array length bounds. Counts and ranges the spec
 * requires (exactly 5 questions, rubric 1–4, whole numbers, ...) are described
 * to the model with `.describe()` and checked afterwards with
 * `lessonContentProblems()` / `writingFeedbackProblems()`.
 *
 * Note: the SDK's schema transform (0.128) sends enums to the API only as a
 * description hint; zod still enforces them when the response is parsed.
 */

export const GRADE_BANDS = ['7-8', '9-10'] as const;
export const GradeBand = z.enum(GRADE_BANDS);
export type GradeBand = z.infer<typeof GradeBand>;

export const QUIZ_SKILLS = ['main-idea', 'detail', 'inference', 'vocabulary', 'purpose', 'sequence'] as const;
export const QuizSkill = z.enum(QUIZ_SKILLS);
export type QuizSkill = z.infer<typeof QuizSkill>;

export const WRITING_PROMPT_KINDS = ['summary', 'headline', 'opinion', 'creative', 'letter'] as const;
export const WritingPromptKind = z.enum(WRITING_PROMPT_KINDS);
export type WritingPromptKind = z.infer<typeof WritingPromptKind>;

export const LessonLevel = z.object({
  title: z.string().describe('A clear, level-appropriate headline for the retelling.'),
  paragraphs: z.array(z.string()).describe('The original retelling, one string per paragraph.'),
});
export type LessonLevel = z.infer<typeof LessonLevel>;

export const VocabularyItem = z.object({
  word: z.string().describe('A tier-2 word exactly as it appears in the retelling.'),
  partOfSpeech: z.string(),
  definition: z.string().describe('A kid-friendly definition for ages 12 to 15.'),
  example: z.string().describe('A new example sentence, not copied from the retelling.'),
  band: z.enum(['7-8', '9-10', 'both']),
});
export type VocabularyItem = z.infer<typeof VocabularyItem>;

export const QuizQuestion = z.object({
  id: z.string(),
  skill: QuizSkill,
  question: z.string(),
  choices: z.array(z.string()).describe('Exactly 4 answer choices.'),
  answerIndex: z.number().describe('Zero-based index of the correct choice: a whole number from 0 to 3.'),
  explanation: z.string(),
});
export type QuizQuestion = z.infer<typeof QuizQuestion>;

export const WritingPrompt = z.object({
  id: z.string(),
  kind: WritingPromptKind,
  prompt: z.string(),
  minWords: z.number().describe('A whole number of words.'),
  maxWords: z.number().describe('A whole number of words, at least minWords.'),
  tips: z.array(z.string()),
});
export type WritingPrompt = z.infer<typeof WritingPrompt>;

export const LessonContent = z.object({
  keyIdea: z.string().describe('One sentence: what the story is about and why it matters.'),
  levels: z
    .object({
      '7-8': LessonLevel.describe('180 to 260 words.'),
      '9-10': LessonLevel.describe('240 to 340 words.'),
    })
    .describe('The same story retold at two reading levels.'),
  vocabulary: z.array(VocabularyItem).describe('5 to 8 tier-2 words that appear in the retellings.'),
  quiz: z.array(QuizQuestion).describe('Exactly 5 questions.'),
  writingPrompts: z.array(WritingPrompt).describe('Exactly 3 prompts.'),
  discussion: z.array(z.string()).describe('Exactly 2 open questions to talk about.'),
});
export type LessonContent = z.infer<typeof LessonContent>;

export const RubricScores = z.object({
  ideas: z.number().describe('A whole number from 1 to 4.'),
  organization: z.number().describe('A whole number from 1 to 4.'),
  wordChoice: z.number().describe('A whole number from 1 to 4.'),
  conventions: z.number().describe('A whole number from 1 to 4.'),
});
export type RubricScores = z.infer<typeof RubricScores>;

export const WritingStats = z.object({
  words: z.number(),
  sentences: z.number(),
  avgSentenceLength: z.number(),
  uniqueWordRatio: z.number(),
  longWords: z.number(),
});
export type WritingStats = z.infer<typeof WritingStats>;

export const WritingFeedback = z.object({
  glow: z.array(z.string()).describe('Exactly 2 specific strengths, quoting the student.'),
  grow: z.array(z.string()).describe('Exactly 2 specific, doable improvements.'),
  nextStep: z.string(),
  rubric: RubricScores,
  usedVocabulary: z.array(z.string()),
  stats: WritingStats,
  generator: z.enum(['claude', 'heuristic']),
});
export type WritingFeedback = z.infer<typeof WritingFeedback>;

export const DefinitionSense = z.object({
  definition: z.string(),
  example: z.string().optional(),
});
export type DefinitionSense = z.infer<typeof DefinitionSense>;

export const DefinitionMeaning = z.object({
  partOfSpeech: z.string(),
  definitions: z.array(DefinitionSense),
});
export type DefinitionMeaning = z.infer<typeof DefinitionMeaning>;

export const Definition = z.object({
  word: z.string(),
  phonetic: z.string().optional(),
  audioUrl: z.string().optional(),
  meanings: z.array(DefinitionMeaning),
});
export type Definition = z.infer<typeof Definition>;

/** `Schema`-suffixed aliases for call sites that prefer that naming. */
export const GradeBandSchema = GradeBand;
export const LessonContentSchema = LessonContent;
export const WritingFeedbackSchema = WritingFeedback;
export const DefinitionSchema = Definition;

export const LESSON_COUNTS = {
  vocabularyMin: 5,
  vocabularyMax: 8,
  quiz: 5,
  choices: 4,
  writingPrompts: 3,
  discussion: 2,
} as const;

/**
 * Checks the counts and ranges the structured-output schema cannot enforce.
 * Returns human-readable problems; an empty array means the lesson is complete.
 */
export function lessonContentProblems(content: LessonContent): string[] {
  const problems: string[] = [];
  const { vocabulary, quiz, writingPrompts, discussion, levels } = content;
  if (vocabulary.length < LESSON_COUNTS.vocabularyMin || vocabulary.length > LESSON_COUNTS.vocabularyMax) {
    problems.push(`vocabulary has ${vocabulary.length} words (expected 5 to 8)`);
  }
  if (quiz.length !== LESSON_COUNTS.quiz) problems.push(`quiz has ${quiz.length} questions (expected 5)`);
  quiz.forEach((q, i) => {
    if (q.choices.length !== LESSON_COUNTS.choices) problems.push(`quiz[${i}] has ${q.choices.length} choices (expected 4)`);
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= q.choices.length) {
      problems.push(`quiz[${i}].answerIndex ${q.answerIndex} is out of range`);
    }
  });
  if (writingPrompts.length !== LESSON_COUNTS.writingPrompts) {
    problems.push(`writingPrompts has ${writingPrompts.length} prompts (expected 3)`);
  }
  writingPrompts.forEach((p, i) => {
    if (!Number.isInteger(p.minWords) || !Number.isInteger(p.maxWords) || p.minWords < 1 || p.maxWords < p.minWords) {
      problems.push(`writingPrompts[${i}] has an invalid word range`);
    }
  });
  if (discussion.length !== LESSON_COUNTS.discussion) {
    problems.push(`discussion has ${discussion.length} questions (expected 2)`);
  }
  for (const band of GRADE_BANDS) {
    if (levels[band].paragraphs.length === 0) problems.push(`levels.${band} has no paragraphs`);
  }
  return problems;
}

/** Same idea as `lessonContentProblems` for writing feedback. */
export function writingFeedbackProblems(feedback: WritingFeedback): string[] {
  const problems: string[] = [];
  if (feedback.glow.length !== 2) problems.push(`glow has ${feedback.glow.length} items (expected 2)`);
  if (feedback.grow.length !== 2) problems.push(`grow has ${feedback.grow.length} items (expected 2)`);
  for (const [key, value] of Object.entries(feedback.rubric)) {
    if (!Number.isInteger(value) || value < 1 || value > 4) problems.push(`rubric.${key} ${value} is outside 1 to 4`);
  }
  return problems;
}
