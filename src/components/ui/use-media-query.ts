'use client';

import { useSyncExternalStore } from 'react';

/**
 * `useMediaQuery('(min-width: 64rem)')` → boolean | null (null during the
 * server render and hydration). Use it to switch word-note placement
 * (margin ≥ 1024, sheet or inline below), never to hide content that
 * affects layout on first paint — use CSS breakpoints for that.
 */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}

/** DESIGN §5.4 breakpoints as media queries. */
export const MEDIA = {
  md: '(min-width: 48rem)',
  lg: '(min-width: 64rem)',
  xl: '(min-width: 80rem)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;

/** True when the Web Speech API can speak (hide speaker buttons otherwise). */
export function useCanSpeak(): boolean | null {
  return useSyncExternalStore(
    () => () => {},
    () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
    () => null,
  );
}

/** Say a word with the device voice (the "Say it" speaker button). */
export function speakWord(text: string, rate = 0.85): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.lang = 'en';
  window.speechSynthesis.speak(utterance);
}
