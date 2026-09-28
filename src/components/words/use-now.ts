'use client';

import { useSyncExternalStore } from 'react';

/**
 * The current time, rounded down to the minute and refreshed every 30 s, so
 * "Due now" and "Tomorrow" labels stay true while a page is open. Null during
 * the server render and hydration (pair it with the local store, which is
 * null then too).
 */
const MINUTE = 60_000;

function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 30_000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

// Stable within a minute, so React sees the same snapshot until it changes.
const getSnapshot = () => Math.floor(Date.now() / MINUTE) * MINUTE + (MINUTE - 1);
const getServerSnapshot = () => null;

/** Now (end of the current minute, so a word due this minute already counts as due). */
export function useNow(): number | null {
  return useSyncExternalStore<number | null>(subscribe, getSnapshot, getServerSnapshot);
}
