'use client';

import { useRef, type RefObject } from 'react';

import { Sheet } from '@/components/ui/Sheet';
import { SkeletonText } from '@/components/ui/Skeleton';

import { WordNoteContent, type WordNoteData } from './WordNoteContent';

/**
 * The mobile word note (DESIGN §8.7, §11.9): a non-modal bottom sheet. No
 * scrim; the page stays scrollable and tappable; tapping another word swaps
 * the content; the tapped word stays visible above it (tap words carry
 * scroll-margin-bottom: 45svh). Focus moves to the headword on open and back
 * to the word on close. Pad the reader's bottom with `var(--sheet-h)`.
 */
export interface WordSheetProps {
  id: string;
  open: boolean;
  onClose: () => void;
  /** Note data; null while it loads (shows a skeleton of the same shape). */
  data: WordNoteData | null;
  saved?: boolean;
  onSave?: () => void;
  canSave?: boolean;
  canSpeak?: boolean;
  onSpeak?: () => void;
  /** The tapped word, which gets focus back on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function WordSheet({ id, open, onClose, data, saved, onSave, canSave, canSpeak, onSpeak, returnFocusRef }: WordSheetProps) {
  const headwordRef = useRef<HTMLParagraphElement>(null);
  const headwordId = `${id}-word`;
  return (
    <Sheet
      id={id}
      open={open}
      onClose={onClose}
      labelledBy={data ? headwordId : undefined}
      label={data ? undefined : 'Word note'}
      closeLabel="Close word note"
      initialFocusRef={headwordRef}
      returnFocusRef={returnFocusRef}
    >
      {data ? (
        <WordNoteContent
          key={data.word}
          className="fade-in"
          data={data}
          headwordId={headwordId}
          headwordRef={headwordRef}
          saved={saved}
          onSave={onSave}
          canSave={canSave}
          canSpeak={canSpeak}
          onSpeak={onSpeak}
          inSheet
        />
      ) : (
        <div className="pr-13" aria-busy="true">
          <span className="skeleton block h-9 w-40" aria-hidden="true" />
          <SkeletonText lines={3} className="mt-4" />
        </div>
      )}
    </Sheet>
  );
}
