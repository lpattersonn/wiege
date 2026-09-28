'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { IconAlert } from '@/components/glyphs/icons';

/**
 * Toast (DESIGN §11.16). One toast at a time, inverted, bottom centre, 16px
 * above the tab bar. 5s, paused while hovered or focused. Call `toast()` from
 * anywhere on the client (no provider); <Toaster /> lives in the root layout.
 *
 *   toast({ message: 'Removed “stamina”.', action: { label: 'Undo', onAction: restore } })
 *   toast({ message: 'Progress can’t be saved…', tone: 'error' })
 */
export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastInput {
  message: string;
  action?: ToastAction;
  /** 'status' (polite, default) or 'error' (role="alert", circled "!"). */
  tone?: 'status' | 'error';
  /** Milliseconds before it closes (default 5000). */
  duration?: number;
}

interface ToastState extends ToastInput {
  id: number;
}

let current: ToastState | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(input: ToastInput): number {
  current = { ...input, id: nextId++ };
  emit();
  return current.id;
}

export function dismissToast(id?: number): void {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  emit();
}

export function useToast() {
  return { toast, dismiss: dismissToast };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

function ToastView({ item }: { item: ToastState }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration ?? 5000);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, item.id]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  return (
    <div
      className="toast-in pointer-events-auto inv flex min-h-12 w-full max-w-[480px] items-center gap-3 rounded-paper px-4 py-3 text-nav leading-snug font-semibold"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      {item.tone === 'error' ? <IconAlert /> : null}
      <p className="min-w-0 flex-1">{item.message}</p>
      {item.action ? (
        <button
          type="button"
          className="-my-2 inline-flex min-h-11 shrink-0 items-center px-1 font-bold underline decoration-2 underline-offset-[5px] hover:decoration-[3px]"
          onClick={() => {
            item.action?.onAction();
            dismissToast(item.id);
          }}
        >
          {item.action.label}
        </button>
      ) : null}
    </div>
  );
}

/** The single toast outlet. Both live regions stay mounted so announcements are reliable. */
export function Toaster() {
  const item = useSyncExternalStore(subscribe, () => current, () => null);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-80 flex flex-col items-center px-(--gutter)"
      style={{ bottom: 'calc(16px + max(var(--tabbar-h, 0px), env(safe-area-inset-bottom)) + var(--sheet-h, 0px))' }}
      data-print="hide"
    >
      <div role="status" aria-live="polite" aria-atomic="true" className="flex w-full justify-center">
        {item && item.tone !== 'error' ? <ToastView key={item.id} item={item} /> : null}
      </div>
      <div role="alert" aria-atomic="true" className="flex w-full justify-center">
        {item && item.tone === 'error' ? <ToastView key={item.id} item={item} /> : null}
      </div>
    </div>
  );
}
