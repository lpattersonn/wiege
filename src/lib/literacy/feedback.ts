import 'server-only';

import { aiAvailable } from '@/lib/ai/client';
import { scanText } from '@/lib/news/safety';
import { claudeFeedback } from '@/lib/literacy/claude';
import { computeWritingStats, findUsedVocabulary } from '@/lib/literacy/feedback-core';
import { WritingFeedback, writingFeedbackProblems, type GradeBand, type WritingPromptKind } from '@/lib/literacy/types';

/**
 * AI writing feedback (SPEC §6). Stateless: nothing is stored or logged about
 * the student's writing. Statistics and vocabulary use are computed locally
 * (the same code the browser runs); Claude writes the glows, grows, next step
 * and rubric. `null` means "use the heuristic result" (AI unavailable, refused,
 * failed or unsafe).
 */

export interface AiFeedbackInput {
  prompt: string;
  text: string;
  gradeBand: GradeBand;
  vocabulary: string[];
  minWords?: number;
  maxWords?: number;
  promptKind?: WritingPromptKind | 'free';
}

// Quoted passages are the student's own words; the safety re-scan covers what the model wrote around them.
const QUOTED = /"[^"\n]*"|“[^”\n]*”/g;

export function modelWrittenText(feedback: Pick<WritingFeedback, 'glow' | 'grow' | 'nextStep'>): string {
  return [...feedback.glow, ...feedback.grow, feedback.nextStep].join('\n').replace(QUOTED, ' ');
}

export async function getAiWritingFeedback(input: AiFeedbackInput): Promise<WritingFeedback | null> {
  if (!aiAvailable()) return null;
  const stats = computeWritingStats(input.text);
  const result = await claudeFeedback({ ...input, words: stats.words, sentences: stats.sentences });
  if (!result.ok) return null;

  const parsed = WritingFeedback.safeParse({
    ...result.value,
    usedVocabulary: findUsedVocabulary(input.text, input.vocabulary),
    stats,
    generator: 'claude',
  });
  if (!parsed.success || writingFeedbackProblems(parsed.data).length > 0) return null;

  const safety = scanText(modelWrittenText(parsed.data));
  if (!safety.safe) {
    console.warn(`[literacy] Claude feedback not used: safety re-scan (${safety.reasons.length} match(es))`);
    return null;
  }
  return parsed.data;
}
