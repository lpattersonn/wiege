import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialState, STORAGE_KEY } from './schema';

type StoreModule = typeof import('./store');

class MemoryStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError');
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

let storage: MemoryStorage;
let windowListeners: Record<string, Array<(event: unknown) => void>>;

function installBrowser(options: { storageThrows?: boolean } = {}) {
  storage = new MemoryStorage();
  windowListeners = {};
  const win = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      (windowListeners[type] ??= []).push(fn);
    },
    get localStorage(): Storage {
      if (options.storageThrows) throw new DOMException('denied', 'SecurityError');
      return storage as unknown as Storage;
    },
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' });
}

async function loadStore(): Promise<StoreModule> {
  vi.resetModules();
  return import('./store');
}

const story = { slug: 's1', title: 'S1', category: 'art', level: '7-8' } as const;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-27T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('local store', () => {
  it('starts fresh, dispatches, and writes to localStorage after a debounce', async () => {
    installBrowser();
    const store = await loadStore();
    expect(store.getLocalState().xp).toBe(0);
    const events = store.dispatch({ type: 'completeRead', ...story });
    expect(events.xpGained).toBe(10);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(300);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).xp).toBe(10);
  });

  it('loads what is already stored, salvaging damaged records', async () => {
    installBrowser();
    const saved = { ...createInitialState(1, 'UTC'), xp: 42, words: { bad: { word: 'bad' } } };
    storage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const store = await loadStore();
    expect(store.getLocalState().xp).toBe(42);
    expect(store.getLocalState().words).toEqual({});
  });

  it('starts fresh when stored text is not JSON', async () => {
    installBrowser();
    storage.setItem(STORAGE_KEY, '{nope');
    const store = await loadStore();
    expect(store.getLocalState().xp).toBe(0);
  });

  it('falls back to memory when storage is blocked', async () => {
    installBrowser({ storageThrows: true });
    const store = await loadStore();
    store.dispatch({ type: 'completeRead', ...story });
    vi.advanceTimersByTime(300);
    expect(store.getLocalState().xp).toBe(10);
    expect(storage.data.size).toBe(0);
  });

  it('stops persisting (but keeps working) when a write fails', async () => {
    installBrowser();
    const store = await loadStore();
    store.getLocalState();
    storage.failWrites = true;
    store.dispatch({ type: 'completeRead', ...story });
    vi.advanceTimersByTime(300);
    expect(store.getLocalState().xp).toBe(10);
  });

  it('rejects invalid actions without touching state', async () => {
    installBrowser();
    const store = await loadStore();
    const before = store.getLocalState();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const events = store.dispatch({ type: 'saveWord', word: 'two words', definition: 'x' });
    spy.mockRestore();
    expect(events).toEqual({ xpGained: 0, newBadges: [], levelUp: null });
    expect(store.getLocalState()).toBe(before);
  });

  it('adopts changes written by another tab', async () => {
    installBrowser();
    const store = await loadStore();
    store.getLocalState();
    const other = { ...createInitialState(1, 'UTC'), xp: 77 };
    for (const fn of windowListeners.storage ?? []) fn({ key: STORAGE_KEY, newValue: JSON.stringify(other) });
    expect(store.getLocalState().xp).toBe(77);
    for (const fn of windowListeners.storage ?? []) fn({ key: STORAGE_KEY, newValue: null });
    expect(store.getLocalState().xp).toBe(0);
  });

  it('notifies event listeners about awards', async () => {
    installBrowser();
    const store = await loadStore();
    const seen: number[] = [];
    const off = store.onLocalEvents((events) => seen.push(events.xpGained));
    store.dispatch({ type: 'completeRead', ...story });
    store.dispatch({ type: 'completeRead', ...story });
    off();
    expect(seen).toEqual([10]);
  });

  it('renders the server snapshot (null) during SSR', async () => {
    vi.useRealTimers();
    const store = await loadStore();
    function Probe() {
      const xp = store.useLocal((s) => s.xp);
      const hydrated = store.useHydrated();
      return createElement('span', null, `${xp === null ? 'placeholder' : xp}|${hydrated}`);
    }
    expect(renderToString(createElement(Probe))).toBe('<span>placeholder|false</span>');
  });
});
