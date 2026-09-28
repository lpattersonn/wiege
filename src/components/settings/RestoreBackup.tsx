'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';

import { IconAlert, IconUpload } from '@/components/glyphs/icons';
import { announceTheme } from '@/components/local/theme';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { parseBackup, summarizeState, type BackupSummary } from '@/lib/local/backup';
import type { LocalState } from '@/lib/local/schema';
import { dispatch, getLocalState } from '@/lib/local/store';

import { countsPhrase, isEmptySummary, restoredMessage, savedOnLine } from './backup-core';

type Pending =
  | { kind: 'preview'; fileName: string; state: LocalState; summary: BackupSummary; device: BackupSummary; savedOn: string | null }
  | { kind: 'error'; fileName: string; message: string };

const ACCEPT = '.json,application/json';

/** A real (visually hidden) file input driven by a button, so the button is what gets focus. */
function useFilePicker(onFile: (file: File) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept={ACCEPT}
      hidden
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) onFile(file);
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid content-start gap-1 rounded-paper border border-line-soft p-3">
      <dt className="text-caption leading-4 font-semibold text-ink-3">{label}</dt>
      <dd className="num order-first text-[24px] leading-7 font-extrabold text-ink">{value}</dd>
    </div>
  );
}

/**
 * "Restore from a backup" (DESIGN §12.8): choose a file, see what is in it
 * ("This file has 23 words, 4 entries and 3 stamps"), then Merge with this
 * device or Replace this device. A file that isn't a valid backup changes
 * nothing and says what to do next.
 */
export function RestoreBackup() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [checking, setChecking] = useState(false);
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const check = async (file: File) => {
    setChecking(true);
    const result = await parseBackup(file);
    setChecking(false);
    if (!result.ok) {
      setPending({ kind: 'error', fileName: file.name, message: result.message });
      return;
    }
    const current = getLocalState();
    setPending({
      kind: 'preview',
      fileName: file.name,
      state: result.state,
      summary: result.summary,
      device: summarizeState(current),
      savedOn: savedOnLine(result.summary.exportedAt, current.prefs.timezone),
    });
  };

  // When the sheet swaps from an error to a preview, the focused button goes away: move focus to the new heading.
  const view = pending ? `${pending.kind}:${pending.fileName}` : null;
  useEffect(() => {
    if (view) headingRef.current?.focus();
  }, [view]);

  const outside = useFilePicker(check);
  const inside = useFilePicker(check);

  const close = () => setPending(null);

  const apply = (mode: 'merge' | 'replace') => {
    if (pending?.kind !== 'preview') return;
    dispatch({ type: 'importBackup', state: pending.state, mode });
    // Replace brings the file's preferences, including the theme.
    if (mode === 'replace') announceTheme(getLocalState().prefs.theme);
    setPending(null);
    toast({ message: restoredMessage(pending.summary) });
  };

  return (
    <>
      <Button variant="secondary" icon={<IconUpload />} onClick={outside.open} loading={checking} loadingLabel="Checking…">
        Restore from a backup
      </Button>
      {outside.input}

      <Sheet
        open={pending !== null}
        onClose={close}
        modal
        labelledBy={titleId}
        closeLabel={pending?.kind === 'preview' ? 'Don’t restore' : 'Close'}
        initialFocusRef={headingRef}
        maxHeight="85svh"
      >
        {pending?.kind === 'preview' ? (
          <div className="pb-2">
            <h2 id={titleId} ref={headingRef} tabIndex={-1} className="pr-13 font-title text-[26px] leading-tight font-bold outline-none">
              Restore this backup?
            </h2>
            <p className="mt-2 text-small break-all text-ink-2">
              {pending.fileName}
              {pending.savedOn ? <span className="break-normal"> {pending.savedOn}</span> : null}
            </p>
            <p className="mt-4 text-ui text-ink">
              {isEmptySummary(pending.summary) ? 'This file is empty: it has no words, entries or stamps.' : `This file has ${countsPhrase(pending.summary)}.`}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Count value={pending.summary.words} label="Words" />
              <Count value={pending.summary.journalEntries} label="Journal entries" />
              <Count value={pending.summary.storiesRead} label="Stories read" />
              <Count value={pending.summary.stamps} label="Stamps" />
            </dl>
            <p className="mt-5 text-ui text-ink-2">Merge keeps everything from both. Replace swaps what’s on this device for the file.</p>
            {!isEmptySummary(pending.device) ? <p className="mt-2 text-small text-ink-2">This device has {countsPhrase(pending.device)} right now.</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => apply('merge')}>Merge with this device</Button>
              <Button variant="secondary" onClick={() => apply('replace')}>
                Replace this device
              </Button>
            </div>
          </div>
        ) : pending?.kind === 'error' ? (
          <div className="pb-2">
            <h2 id={titleId} ref={headingRef} tabIndex={-1} className="pr-13 font-title text-[26px] leading-tight font-bold outline-none">
              This file can’t be restored
            </h2>
            <p className="mt-2 text-small break-all text-ink-2">{pending.fileName}</p>
            <p className="mt-4 flex items-start gap-2 text-ui font-semibold text-ink">
              <IconAlert className="mt-[3px] shrink-0" />
              <span>{pending.message}</span>
            </p>
            <p className="mt-2 text-ui text-ink-2">Nothing on this device was changed.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={inside.open} loading={checking} loadingLabel="Checking…">
                Choose another file
              </Button>
              <Button variant="secondary" onClick={close}>
                Close
              </Button>
            </div>
            {inside.input}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
