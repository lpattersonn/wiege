import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WritingFeedback } from './types';

const mocks = vi.hoisted(() => ({ available: { value: true }, claudeFeedback: vi.fn() }));

vi.mock('@/lib/ai/client', () => ({ aiAvailable: () => mocks.available.value }));
vi.mock('./claude', () => ({ claudeFeedback: mocks.claudeFeedback }));

const { getAiWritingFeedback, modelWrittenText } = await import('./feedback');

const input = {
  prompt: 'Summarise the story.',
  text: 'The team showed they were resilient. They won 3 games in a row because they practised.',
  gradeBand: '7-8' as const,
  vocabulary: ['resilient', 'strategy'],
};

const modelOutput = {
  glow: ['"They won 3 games in a row" is a strong, specific detail.', 'You explain why with "because".'],
  grow: ['Add who the team played.', 'Say what "resilient" looked like in the story.'],
  nextStep: 'Add one sentence about the final game.',
  rubric: { ideas: 3, organization: 3, wordChoice: 3, conventions: 4 },
};

beforeEach(() => {
  mocks.available.value = true;
  mocks.claudeFeedback.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('getAiWritingFeedback', () => {
  it('returns null without calling Claude when AI is not configured', async () => {
    mocks.available.value = false;
    expect(await getAiWritingFeedback(input)).toBeNull();
    expect(mocks.claudeFeedback).not.toHaveBeenCalled();
  });

  it('merges Claude feedback with locally computed statistics and vocabulary', async () => {
    mocks.claudeFeedback.mockResolvedValueOnce({ ok: true, value: modelOutput, model: 'claude-opus-5' });
    const feedback = await getAiWritingFeedback(input);
    expect(feedback).not.toBeNull();
    expect(WritingFeedback.safeParse(feedback).success).toBe(true);
    expect(feedback).toMatchObject({ ...modelOutput, usedVocabulary: ['resilient'], generator: 'claude' });
    expect(feedback?.stats).toMatchObject({ words: 16, sentences: 2 });
    expect(mocks.claudeFeedback).toHaveBeenCalledWith({ ...input, words: 16, sentences: 2 });
  });

  it('returns null when Claude fails', async () => {
    mocks.claudeFeedback.mockResolvedValueOnce({ ok: false, reason: 'rate_limited', detail: '429' });
    expect(await getAiWritingFeedback(input)).toBeNull();
  });

  it('re-scans only what the model wrote, not the words it quotes from the student', async () => {
    const quotingStudent = { ...modelOutput, glow: ['Your line "the villain tried to murder the hero" builds tension.', modelOutput.glow[1]] };
    mocks.claudeFeedback.mockResolvedValueOnce({ ok: true, value: quotingStudent, model: 'claude-opus-5' });
    expect(await getAiWritingFeedback(input)).not.toBeNull();

    const unsafe = { ...modelOutput, nextStep: 'Describe the murder in more detail.' };
    mocks.claudeFeedback.mockResolvedValueOnce({ ok: true, value: unsafe, model: 'claude-opus-5' });
    expect(await getAiWritingFeedback(input)).toBeNull();
  });

  it('strips straight and curly quotations before scanning', () => {
    expect(modelWrittenText({ glow: ['A "quoted" b', 'C “curly” d'], grow: [], nextStep: 'E' })).not.toMatch(/quoted|curly/);
  });
});
