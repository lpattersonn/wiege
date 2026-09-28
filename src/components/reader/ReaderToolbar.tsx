'use client';

import { useCallback, useId, useRef, useState, type ReactNode } from 'react';

import { IconAa, IconClose, IconPause, IconSpeak } from '@/components/glyphs/icons';
import { Button, IconButton } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Popover } from '@/components/ui/Popover';
import { ReadingSettings, type ReadingSettingsValue } from '@/components/ui/ReadingSettings';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { MEDIA, useCanSpeak, useMediaQuery } from '@/components/ui/use-media-query';
import type { GradeBand } from '@/lib/literacy/types';

import { LookUpField } from './LookUpField';
import { READER_ID } from './ids';
import { levelParagraphs, useReader } from './ReaderRoot';
import { useListen } from './use-listen';
import type { ReaderVocab } from './word-note';

/**
 * The reader bar (DESIGN §12.4, §11.20): sticky under the app nav while the
 * story is on screen. Level switch (Grade 7–8 / 9–10), reading settings (a
 * popover from 768px, a modal sheet below, with "Look up a word" inside) and
 * Listen. Below 768px the bar holds back + category + Aa + Listen and the
 * level switch sits under it, in the page.
 */

const LEVEL_OPTIONS = [
  { value: '7-8', label: 'Grade 7–8' },
  { value: '9-10', label: 'Grade 9–10' },
] as const;

const DEFAULT_SETTINGS: ReadingSettingsValue = { readingFont: 'book', textSize: 'm', lineSpacing: 'normal', theme: 'system' };

export function ReaderToolbar({ start, vocabulary }: { start?: ReactNode; vocabulary: ReaderVocab[] }) {
  const { level, prefs, setLevel, updateSettings } = useReader();
  const md = useMediaQuery(MEDIA.md);
  const canSpeak = useCanSpeak();
  const settingsTitleId = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  const aaRef = useRef<HTMLButtonElement>(null);

  const getParagraphs = useCallback(() => {
    const root = document.getElementById(READER_ID);
    return root ? levelParagraphs(root, root.getAttribute('data-level') ?? '7-8') : [];
  }, []);
  const listen = useListen({ getParagraphs, rate: prefs?.readAloudRate ?? 1 });

  const onLevel = (next: GradeBand) => {
    if (listen.state !== 'idle') listen.stop();
    setLevel(next);
  };

  const settingsValue: ReadingSettingsValue = prefs
    ? { readingFont: prefs.readingFont, textSize: prefs.textSize, lineSpacing: prefs.lineSpacing, theme: prefs.theme }
    : DEFAULT_SETTINGS;
  const settings = (
    <ReadingSettings value={settingsValue} onChange={updateSettings} preview="Tap any word you don’t know. The pen circles it and the note tells you what it means.">
      <LookUpField vocabulary={vocabulary} />
    </ReadingSettings>
  );

  const levelSwitch = (block: boolean) => (
    <Segmented legend="Reading level" options={LEVEL_OPTIONS} value={level} onChange={onLevel} block={block} className={block ? 'w-full' : undefined} />
  );

  return (
    <>
      <div
        data-reader-bar=""
        className={cx(
          'translucent-bar sticky top-14 z-10 -mx-(--gutter) border-b border-[color-mix(in_srgb,var(--ink)_8%,transparent)] px-(--gutter)',
          'lg:mx-0 lg:px-0',
        )}
      >
        <div className="flex min-h-14 items-center gap-2 py-1.5 md:gap-4">
          {start}
          <div className="hidden md:block">{levelSwitch(false)}</div>
          <span className="ml-auto" />
          {md === false ? (
            <>
              <IconButton ref={aaRef} label="Reading settings" icon={<IconAa />} aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)} />
              <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} modal labelledBy={settingsTitleId} closeLabel="Close reading settings" maxHeight="85svh" returnFocusRef={aaRef}>
                <h2 id={settingsTitleId} className="mb-5 pr-14 type-h4">
                  Reading settings
                </h2>
                {settings}
              </Sheet>
            </>
          ) : (
            <Popover label="Reading settings" width={360} trigger={(p) => <IconButton {...p} label="Reading settings" icon={<IconAa />} />}>
              {settings}
            </Popover>
          )}
          {canSpeak === false ? null : <ListenButtons state={listen.state} onStart={listen.start} onPause={listen.pause} onResume={listen.resume} onStop={listen.stop} />}
        </div>
      </div>
      <div className="mt-4 md:hidden">{levelSwitch(true)}</div>
    </>
  );
}

function ListenButtons({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  state: 'idle' | 'playing' | 'paused';
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  if (state === 'idle') {
    return (
      <>
        <IconButton label="Listen to this story" icon={<IconSpeak />} onClick={onStart} className="md:hidden" />
        <Button variant="secondary" size="sm" icon={<IconSpeak />} onClick={onStart} className="max-md:hidden" aria-label="Listen to this story">
          Listen
        </Button>
      </>
    );
  }
  return (
    <span className="flex items-center gap-2">
      {state === 'playing' ? (
        <Button variant="secondary" size="sm" icon={<IconPause />} onClick={onPause} className="min-w-11">
          Pause
        </Button>
      ) : (
        <Button variant="secondary" size="sm" icon={<IconSpeak />} onClick={onResume} className="min-w-11">
          Resume
        </Button>
      )}
      <IconButton label="Stop reading aloud" icon={<IconClose />} onClick={onStop} />
    </span>
  );
}
