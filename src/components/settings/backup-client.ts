'use client';

import { useSyncExternalStore } from 'react';

import { backupFilename, exportBackup } from '@/lib/local/backup';
import { getLocalState } from '@/lib/local/store';

/**
 * Browser side of "Save a backup file" (SPEC §4, DESIGN §12.7–§12.8).
 *
 * The time of the last saved backup is a per-device convenience that drives
 * the /me reminder. The store's schema has no field for it, so it lives in its
 * own key, `wiege:last-backup`, next to `wiege:v1`. It never leaves the device
 * and "Clear everything" removes it too.
 */

export const LAST_BACKUP_KEY = 'wiege:last-backup';

type Listener = () => void;
const listeners = new Set<Listener>();
/** undefined = not read yet; null = no backup saved on this device. */
let cached: number | null | undefined;

function readStored(): number | null {
  try {
    const raw = window.localStorage.getItem(LAST_BACKUP_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== LAST_BACKUP_KEY && event.key !== null) return;
  cached = readStored();
  emit();
}

function subscribe(listener: Listener): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): number | null {
  if (cached === undefined) cached = readStored();
  return cached;
}

const getServerSnapshot = (): undefined => undefined;

/** When the last backup file was saved on this device: undefined until hydrated, null for never. */
export function useLastBackupAt(): number | null | undefined {
  return useSyncExternalStore<number | null | undefined>(subscribe, getSnapshot, getServerSnapshot);
}

/*
 * A clock that ticks once a minute, for "3 days ago" lines (null until
 * hydrated). The value is cached between ticks so getSnapshot is stable even
 * across a minute boundary.
 */
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
let minuteValue: number | null = null;
function minuteNow(): number {
  if (minuteValue === null) minuteValue = currentMinute();
  return minuteValue;
}
function subscribeMinute(listener: Listener): () => void {
  // Refresh on (re)subscribe; React re-reads the snapshot right after subscribing.
  minuteValue = currentMinute();
  const timer = window.setInterval(() => {
    minuteValue = currentMinute();
    listener();
  }, 60_000);
  return () => window.clearInterval(timer);
}
const serverNow = (): null => null;

export function useMinuteClock(): number | null {
  return useSyncExternalStore<number | null>(subscribeMinute, minuteNow, serverNow);
}

export function recordBackup(at: number): void {
  cached = at;
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, String(at));
  } catch {
    // Storage blocked: remember it for this visit only.
  }
  emit();
}

export function forgetBackup(): void {
  cached = null;
  try {
    window.localStorage.removeItem(LAST_BACKUP_KEY);
  } catch {
    // Nothing stored, nothing to remove.
  }
  emit();
}

/**
 * Downloads everything on this device as `wiege-backup-YYYY-MM-DD.json` and
 * records the time. Returns the file name, or null when the browser refused.
 */
export function saveBackupFile(now: number = Date.now()): string | null {
  try {
    const state = getLocalState();
    const blob = exportBackup(state, now);
    const filename = backupFilename(now, state.prefs.timezone);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before releasing the blob.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    recordBackup(now);
    return filename;
  } catch {
    return null;
  }
}
