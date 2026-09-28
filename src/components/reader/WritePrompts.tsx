'use client';

import dynamic from 'next/dynamic';
import { useCallback, useId, useState } from 'react';

import type { WritingPromptInput } from '@/components/journal/WritingEditor';
import { useLocalState } from '@/components/local/hooks';
import { MiniTick } from '@/components/pen/marks';
import { cx } from '@/components/ui/cx';
import type { LocalState } from '@/lib/local/schema';

import { useReader } from './ReaderRoot';

// The editor appears only after a prompt is picked, so its code loads then, not with the story.
const WritingEditor = dynamic(() => import('@/components/journal/WritingEditor').then((m) => m.WritingEditor), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" className="grid max-w-[36em] gap-4">
      <span className="skeleton block h-7 w-4/5" aria-hidden="true" />
      <span className="skeleton block h-56 w-full rounded-control!" aria-hidden="true" />
      <span className="sr-only">Opening the editor.</span>
    </div>
  ),
});

/**
 * "Write back" (SPEC §8): three prompt cards; picking one opens the shared
 * inline <WritingEditor> under them. A prompt the student already started
 * shows its saved word count and reopens that journal entry.
 */
const KIND_LABELS: Record<string, string> = {
  summary: 'Summary',
  headline: 'Headlines',
  opinion: 'Your opinion',
  creative: 'Make it up',
  letter: 'A message',
};

interface Draft {
  id: string;
  prompt: string;
  wordCount: number;
}

const sameDrafts = (a: Draft[], b: Draft[]) => a.length === b.length && a.every((d, i) => d.id === b[i].id && d.prompt === b[i].prompt && d.wordCount === b[i].wordCount);

export function WritePrompts({ prompts, vocabulary }: { prompts: WritingPromptInput[]; vocabulary: string[] }) {
  const { story, level } = useReader();
  const editorId = useId();
  const [chosen, setChosen] = useState<string | null>(null);

  const selectDrafts = useCallback(
    (s: LocalState): Draft[] =>
      Object.values(s.journal)
        .filter((e) => e.storySlug === story.slug)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((e) => ({ id: e.id, prompt: e.prompt, wordCount: e.wordCount })),
    [story.slug],
  );
  const drafts = useLocalState(selectDrafts, sameDrafts);
  const draftFor = (prompt: WritingPromptInput) => drafts?.find((d) => d.prompt === prompt.prompt);
  const active = prompts.find((p) => p.id === chosen) ?? null;

  return (
    <div>
      <p className="type-ui text-ink-2">Pick a prompt. Your writing saves on this device as you type, and lives in your journal.</p>
      <ul className="mt-6 grid gap-3">
        {prompts.map((prompt) => {
          const pressed = prompt.id === chosen;
          const draft = draftFor(prompt);
          return (
            <li key={prompt.id}>
              <button
                type="button"
                aria-pressed={pressed}
                aria-controls={pressed ? editorId : undefined}
                onClick={() => setChosen(pressed ? null : prompt.id)}
                className={cx(
                  'grid w-full cursor-pointer gap-2 rounded-control bg-paper text-left transition-[border-color,background-color] duration-160 ease-out',
                  pressed ? 'border-2 border-ink px-[19.5px] py-[15.5px]' : 'border-[1.5px] border-line-control px-5 py-4 hover:border-ink hover:bg-sheet',
                )}
              >
                <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-small leading-snug font-bold text-ink">
                  {KIND_LABELS[prompt.kind] ?? 'Write'}
                  {pressed ? <span className="font-semibold text-ink-2">Writing this one</span> : null}
                </span>
                <span className="block type-choice text-ink">{prompt.prompt}</span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption leading-snug text-ink-3">
                  <span>
                    Aim for <span className="num">{prompt.minWords}</span> to <span className="num">{prompt.maxWords}</span> words
                  </span>
                  {draft ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-ink-2">
                      <MiniTick size={14} />
                      Draft saved: <span className="num">{draft.wordCount}</span> {draft.wordCount === 1 ? 'word' : 'words'}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {active ? (
        <div id={editorId} className="mt-10">
          <WritingEditor
            key={active.id}
            storySlug={story.slug}
            storyTitle={story.titles[level]}
            prompt={active}
            vocabulary={vocabulary}
            entryId={draftFor(active)?.id}
            gradeBand={level}
            variant="inline"
          />
        </div>
      ) : null}
    </div>
  );
}
