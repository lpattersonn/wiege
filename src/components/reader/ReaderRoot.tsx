'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { setPrefs, setThemePref, usePrefs } from '@/components/local/hooks';
import { InlineScript } from '@/components/local/InlineScript';
import { closeTapWord, getOpenTapWord } from '@/components/pen/tap-store';
import { readingPrefsAttributes, type ReadingSettingsValue } from '@/components/ui/ReadingSettings';
import type { CategorySlug } from '@/lib/categories';
import type { GradeBand } from '@/lib/literacy/types';
import type { Prefs } from '@/lib/local/schema';
import { dispatch } from '@/lib/local/store';

import { READER_ID, TAP_GROUP } from './ids';
import { READER_PREFS_SCRIPT } from './prefs-script';

/**
 * The reader's root island (SPEC §8, DESIGN §12.4). Wraps the server-rendered
 * story in an <article> that carries the reading level and the reading
 * settings as data attributes: CSS shows the chosen level's title and text
 * (both are in the HTML) and `.type-read` follows the settings. An inline
 * script applies the stored choices before first paint; after hydration the
 * store takes over. Level and settings changes keep the paragraph being read
 * where it was on screen. Also records `startRead` for this device.
 */

export interface ReaderStory {
  slug: string;
  category: CategorySlug;
  titles: Record<GradeBand, string>;
}

interface ReaderContextValue {
  story: ReaderStory;
  level: GradeBand;
  /** Null until the on-device store has loaded. */
  prefs: Prefs | null;
  setLevel: (level: GradeBand) => void;
  updateSettings: (patch: Partial<ReadingSettingsValue>) => void;
}

const ReaderContext = createContext<ReaderContextValue | null>(null);

export function useReader(): ReaderContextValue {
  const value = useContext(ReaderContext);
  if (!value) throw new Error('useReader must be used inside <ReaderRoot>');
  return value;
}

const DEFAULT_SETTINGS = { readingFont: 'book', textSize: 'm', lineSpacing: 'normal' } as const;

/** Paragraphs of the level on screen. */
export function levelParagraphs(root: ParentNode, level: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-level-body="${level}"] [data-para]`));
}

/** Everything under the sticky reader bar counts as off-screen for keeping the place. */
const READING_LINE = 128;

export function ReaderRoot({ story, children }: { story: ReaderStory; children: ReactNode }) {
  const prefs = usePrefs();
  const level: GradeBand = prefs?.gradeBand ?? '7-8';
  const ref = useRef<HTMLElement>(null);
  const hydrated = prefs !== null;

  useEffect(() => {
    if (!hydrated) return;
    dispatch({ type: 'startRead', slug: story.slug, title: story.titles[level], category: story.category, level });
  }, [hydrated, level, story]);

  /** Runs `change` synchronously and keeps the paragraph being read at the same place on screen. */
  const keepPlace = useCallback((change: () => void) => {
    const root = ref.current;
    if (!root) {
      change();
      return;
    }
    const before = levelParagraphs(root, root.getAttribute('data-level') ?? '7-8');
    // The paragraph being read: the first with a couple of lines showing below the bar.
    const index = before.findIndex((p) => p.getBoundingClientRect().bottom > READING_LINE + 64);
    const top = index >= 0 ? before[index].getBoundingClientRect().top : Infinity;
    flushSync(change);
    // The story's first paragraph still starts below the bar: the student is at the top, nothing to keep.
    if (index < 0 || (index === 0 && top > READING_LINE)) return;
    const after = levelParagraphs(root, root.getAttribute('data-level') ?? '7-8');
    const target = after[Math.min(index, after.length - 1)];
    if (!target) return;
    const delta = target.getBoundingClientRect().top - top;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' });
  }, []);

  const setLevel = useCallback(
    (next: GradeBand) => {
      keepPlace(() => setPrefs({ gradeBand: next }));
      // Keep the open word open if it's in the new level too (DESIGN §12.4).
      const open = getOpenTapWord(TAP_GROUP);
      const root = ref.current;
      if (!open || !root || open.anchor.closest('[data-level-body]')?.getAttribute('data-level-body') === next) return;
      const same = root.querySelector<HTMLElement>(`[data-level-body="${next}"] [data-vocab="${CSS.escape(open.word)}"] button.tap`);
      if (same) same.click();
      else closeTapWord(TAP_GROUP);
    },
    [keepPlace],
  );

  const updateSettings = useCallback(
    (patch: Partial<ReadingSettingsValue>) => {
      const { theme, ...reading } = patch;
      keepPlace(() => {
        if (theme) setThemePref(theme);
        if (Object.keys(reading).length) setPrefs(reading);
      });
    },
    [keepPlace],
  );

  const value = useMemo(() => ({ story, level, prefs, setLevel, updateSettings }), [story, level, prefs, setLevel, updateSettings]);
  const attributes = readingPrefsAttributes(prefs ?? DEFAULT_SETTINGS);

  return (
    <ReaderContext.Provider value={value}>
      <article
        ref={ref}
        id={READER_ID}
        data-level={level}
        {...attributes}
        // The inline script may already have set these from the store (the DOM wins).
        suppressHydrationWarning
        className="group/reader [overflow-anchor:none]"
        style={{ paddingBottom: 'var(--sheet-h, 0px)' }}
      >
        <InlineScript html={READER_PREFS_SCRIPT} />
        {children}
      </article>
    </ReaderContext.Provider>
  );
}
