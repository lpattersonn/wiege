'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which tap word is open, per group ("hero", "reader"…). A tiny module store
 * so story text can stay server-rendered: each <TapWord> is a small island
 * that reads and writes this store, and the note controller (margin note on
 * desktop, sheet on mobile) subscribes to the same group. Only one word is
 * open per group; opening another replaces it. Esc closes the open word and
 * returns focus to it.
 */
export interface OpenTapWord {
  /** Vocabulary key (as passed to <TapWord word=…>). */
  word: string;
  /** The tapped button (for placement, leader arrows and focus return). */
  anchor: HTMLElement;
  /** Instance id of the TapWord that opened (the same word can appear twice). */
  instance: string;
  /** Measured loop aspect for the anchor box. */
  aspect?: number;
  /** Increments on every open, so notes can replay their fade. */
  serial: number;
}

type Listener = () => void;

const state = new Map<string, OpenTapWord | null>();
const listeners = new Set<Listener>();
let serial = 0;
let escAttached = false;

function emit() {
  listeners.forEach((l) => l());
}

function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  for (const [group, open] of state) {
    if (open) closeTapWord(group, { returnFocus: true });
  }
}

export function openTapWord(group: string, word: string, anchor: HTMLElement, instance: string, aspect?: number): void {
  state.set(group, { word, anchor, instance, aspect, serial: ++serial });
  if (!escAttached && typeof document !== 'undefined') {
    document.addEventListener('keydown', onEscape);
    escAttached = true;
  }
  emit();
}

export function closeTapWord(group: string, { returnFocus = false }: { returnFocus?: boolean } = {}): void {
  const open = state.get(group);
  if (!open) return;
  state.set(group, null);
  emit();
  if (returnFocus) open.anchor.focus({ preventScroll: true });
}

export function getOpenTapWord(group: string): OpenTapWord | null {
  return state.get(group) ?? null;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The open word in a group, or null. Server snapshot: null. */
export function useTapWord(group: string): OpenTapWord | null {
  return useSyncExternalStore(
    subscribe,
    () => state.get(group) ?? null,
    () => null,
  );
}
