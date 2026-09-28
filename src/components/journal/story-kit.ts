'use client';

import { useEffect, useState } from 'react';

import type { CategorySlug } from '@/lib/categories';
import type { GradeBand } from '@/lib/literacy/types';

import type { PromptInput } from './journal-helpers';

/**
 * A story's writing kit, from `GET /journal/prompts/<slug>` (see
 * src/app/journal/prompts/[slug]/route.ts): its prompts, vocabulary and titles.
 */
export interface StoryKit {
  slug: string;
  category: CategorySlug;
  titles: Record<GradeBand, string>;
  isSample: boolean;
  vocabulary: Array<{ word: string; band: GradeBand | 'both' }>;
  prompts: PromptInput[];
}

export type KitState = { status: 'loading' } | { status: 'ready'; kit: StoryKit } | { status: 'missing' } | { status: 'error' };

const cache = new Map<string, Promise<KitState>>();

function loadKit(slug: string): Promise<KitState> {
  const hit = cache.get(slug);
  if (hit) return hit;
  const request = fetch(`/journal/prompts/${encodeURIComponent(slug)}`)
    .then(async (res): Promise<KitState> => {
      if (res.status === 404 || res.status === 400) return { status: 'missing' };
      if (!res.ok) return { status: 'error' };
      return { status: 'ready', kit: (await res.json()) as StoryKit };
    })
    .catch((): KitState => ({ status: 'error' }));
  cache.set(slug, request);
  // Don't keep failures: a later visit can try again.
  request.then((state) => {
    if (state.status === 'error') cache.delete(slug);
  });
  return request;
}

/** Loads the kit for `slug` (null = no story). */
export function useStoryKit(slug: string | null | undefined): KitState | null {
  const [state, setState] = useState<{ slug: string; value: KitState } | null>(null);
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    loadKit(slug).then((value) => {
      if (alive) setState({ slug, value });
    });
    return () => {
      alive = false;
    };
  }, [slug]);
  if (!slug) return null;
  return state && state.slug === slug ? state.value : { status: 'loading' };
}

/** Vocabulary words for the student's band (lesson words marked 'both' count for both). */
export function kitVocabulary(kit: StoryKit, band: GradeBand): string[] {
  return kit.vocabulary.filter((v) => v.band === 'both' || v.band === band).map((v) => v.word);
}

/** The kit prompt matching a saved entry: same text, else same kind. */
export function matchPrompt(kit: StoryKit, promptText: string, kind: string): PromptInput | null {
  return kit.prompts.find((p) => p.prompt === promptText) ?? kit.prompts.find((p) => p.kind === kind) ?? null;
}
