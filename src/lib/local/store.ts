'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

import { defaultTimeZone } from '@/lib/time';

import { LocalActionSchema, reduceLocalState, noEvents, type LocalAction, type LocalEvents } from './reducers';
import { createInitialState, safeJsonParse, salvageLocalState, STORAGE_KEY, type LocalState } from './schema';

/**
 * The on-device store (SPEC §4). One module-level state per tab, persisted to
 * `localStorage['wiege:v1']` with debounced writes, synced across tabs through
 * the `storage` event, and exposed to React via `useSyncExternalStore`.
 *
 * On the server and during hydration the snapshot is `null` ("not hydrated
 * yet"): islands render a same-size placeholder, then the real values.
 * When storage is unavailable (private mode, blocked site data) the store keeps
 * working in memory and `usePersistent()` returns false so the UI can say
 * "Progress can't be saved in this browser mode".
 */

const WRITE_DELAY_MS = 250;
const PROBE_KEY = 'wiege:probe';

type Listener = () => void;
type EventListener = (events: LocalEvents, action: LocalAction) => void;

let state: LocalState | null = null;
let persistent = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;
const listeners = new Set<Listener>();
const eventListeners = new Set<EventListener>();

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const store = window.localStorage;
    store.setItem(PROBE_KEY, '1');
    store.removeItem(PROBE_KEY);
    return store;
  } catch {
    return null;
  }
}

function readStored(store: Storage | null, now: number): LocalState | null {
  if (!store) return null;
  try {
    const text = store.getItem(STORAGE_KEY);
    return text ? salvageLocalState(safeJsonParse(text), now, defaultTimeZone()) : null;
  } catch {
    return null;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function writeNow(): void {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (!persistent || !state) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage revoked mid-session: keep going in memory.
    persistent = false;
    notify();
  }
}

function scheduleWrite(): void {
  if (!persistent) return;
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = setTimeout(writeNow, WRITE_DELAY_MS);
}

function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  // Another tab wrote (or cleared) the state: adopt it. A pending local write is
  // dropped; writes are debounced by 250 ms, so at most that much is lost.
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  const now = Date.now();
  let next: LocalState | null = null;
  if (event.newValue) {
    try {
      next = salvageLocalState(safeJsonParse(event.newValue), now, defaultTimeZone());
    } catch {
      next = null;
    }
  }
  state = next ?? createInitialState(now, defaultTimeZone());
  notify();
}

function attachWindowListeners(): void {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;
  window.addEventListener('storage', onStorage);
  // Flush the debounced write before the page goes away.
  window.addEventListener('pagehide', writeNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') writeNow();
  });
}

function ensureLoaded(): LocalState {
  if (state) return state;
  const now = Date.now();
  const store = storage();
  persistent = store !== null;
  state = readStored(store, now) ?? createInitialState(now, defaultTimeZone());
  attachWindowListeners();
  return state;
}

function subscribe(listener: Listener): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getServerSnapshot = (): null => null;

/** The current state (loads it on first use). Browser only. */
export function getLocalState(): LocalState {
  return ensureLoaded();
}

/**
 * Applies an action and returns what was earned. Actions are validated first,
 * so a bad call from UI code can never corrupt stored progress.
 */
export function dispatch(action: LocalAction, now: number = Date.now()): LocalEvents {
  const parsed = LocalActionSchema.safeParse(action);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== 'production') console.error('[wiege] rejected local action', action, parsed.error.issues);
    return noEvents();
  }
  const current = ensureLoaded();
  const result = reduceLocalState(current, parsed.data, now);
  if (result.state !== current) {
    state = result.state;
    scheduleWrite();
    notify();
  }
  if (result.events.xpGained > 0 || result.events.newBadges.length > 0 || result.events.levelUp) {
    for (const listener of eventListeners) listener(result.events, parsed.data);
  }
  return result.events;
}

/** Subscribe to awards from any dispatch (e.g. a global celebration toast). */
export function onLocalEvents(listener: EventListener): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

/** Writes any pending change immediately (e.g. before navigating to a download). */
export function flushLocalStore(): void {
  writeNow();
}

/**
 * Selects from the local state. Returns null until hydrated (server render and
 * the hydration pass), then the selected value. Keep selectors cheap; return a
 * stable value (or pass `isEqual`) when selecting derived arrays or objects.
 */
export function useLocal<T>(selector: (state: LocalState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T | null {
  const cache = useRef<{ state: LocalState; selector: (state: LocalState) => T; value: T } | null>(null);
  const getSnapshot = useCallback((): T => {
    const current = ensureLoaded();
    const previous = cache.current;
    if (previous && previous.state === current && previous.selector === selector) return previous.value;
    const selected = selector(current);
    const value = previous && isEqual(previous.value, selected) ? previous.value : selected;
    cache.current = { state: current, selector, value };
    return value;
  }, [selector, isEqual]);
  return useSyncExternalStore<T | null>(subscribe, getSnapshot, getServerSnapshot);
}

/** Whether progress is being saved on this device; null until hydrated. */
export function usePersistent(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribe,
    () => {
      ensureLoaded();
      return persistent;
    },
    getServerSnapshot,
  );
}

const noopSubscribe = () => () => {};

/** False during the server render and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Test hook: forget the in-memory state and listeners. */
export function resetLocalStoreForTests(): void {
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = null;
  state = null;
  persistent = false;
  listeners.clear();
  eventListeners.clear();
}
