'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { IconTrash } from '@/components/glyphs/icons';
import { InlineScript } from '@/components/local/InlineScript';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { gateScript, StoreGate } from '@/components/words/StoreGate';
import { getOwn, type JournalEntry, type LocalState } from '@/lib/local/schema';
import { dispatch, useLocal } from '@/lib/local/store';

import { ENTRY_TITLE_FALLBACK, ENTRY_TITLE_FREE, ENTRY_TITLE_MISSING, EntryFrame, EntryMeta, EntryMissing, EntrySkeleton } from './EntryParts';
import { dateLabel, freePrompt, kindLabel, type PromptInput } from './journal-helpers';
import { kitVocabulary, matchPrompt, useStoryKit } from './story-kit';
import { markEntryDeleted, WritingEditor } from './WritingEditor';

/**
 * /journal/[id] islands (DESIGN §12.6). The page is a static shell; the entry
 * comes from this device. The h1 is corrected before first paint by an inline
 * script (no flash), and the editor area shows the "not on this device" state
 * straight from the server HTML when the entry isn't here.
 */

const entryHasScript = (id: string) => `if(!(s&&s.journal&&Object.prototype.hasOwnProperty.call(s.journal,${JSON.stringify(id)})))v="missing";`;

function titleFor(entry: Pick<JournalEntry, 'storyTitle'> | undefined): string {
  if (!entry) return ENTRY_TITLE_MISSING;
  return entry.storyTitle || ENTRY_TITLE_FREE;
}

function useEntry(id: string): JournalEntry | undefined | null {
  const select = useCallback((s: LocalState) => getOwn(s.journal, id), [id]);
  return useLocal(select);
}

/** The page h1: the story's title, "Free write", or that the entry isn't here. */
export function EntryTitle({ id, className }: { id: string; className?: string }) {
  const entry = useEntry(id);
  const domId = useId();
  const script =
    `(function(){var e=document.getElementById(${JSON.stringify(domId)});if(!e)return;var t=${JSON.stringify(ENTRY_TITLE_MISSING)};` +
    `try{var s=JSON.parse(localStorage.getItem("wiege:v1")||"null"),j=s&&s.journal,k=${JSON.stringify(id)};` +
    `if(j&&Object.prototype.hasOwnProperty.call(j,k)&&j[k])t=j[k].storyTitle||${JSON.stringify(ENTRY_TITLE_FREE)}}catch(x){}e.textContent=t})()`;
  return (
    <>
      <h1 id={domId} className={className} suppressHydrationWarning>
        {entry === null ? ENTRY_TITLE_FALLBACK : titleFor(entry)}
      </h1>
      <InlineScript html={script} />
    </>
  );
}

const selectBand = (s: LocalState) => s.prefs.gradeBand ?? '7-8';
const selectTimeZone = (s: LocalState) => s.prefs.timezone;

export function EntryEditor({ id }: { id: string }) {
  const entry = useEntry(id);
  if (entry === null) {
    return (
      <StoreGate
        id="entry-gate"
        className="min-h-[70svh]"
        script={gateScript('entry-gate', entryHasScript(id), 'missing')}
        variants={{ missing: <EntryMissing /> }}
        fallback={<EntrySkeleton />}
      />
    );
  }
  if (entry === undefined) {
    return (
      <div className="min-h-[70svh]">
        <EntryMissing />
      </div>
    );
  }
  return <LoadedEntry key={entry.id} entry={entry} />;
}

function LoadedEntry({ entry }: { entry: JournalEntry }) {
  const band = useLocal(selectBand) ?? '7-8';
  const timeZone = useLocal(selectTimeZone);
  const kit = useStoryKit(entry.storySlug);
  const [now] = useState(() => Date.now());

  const kitReady = kit?.status === 'ready' ? kit.kit : null;
  const prompt = useMemo<PromptInput>(() => {
    const fromKit = kitReady ? matchPrompt(kitReady, entry.prompt, entry.promptKind) : null;
    const free = freePrompt(Boolean(entry.storySlug));
    return {
      id: fromKit?.id ?? entry.promptKind,
      kind: entry.promptKind,
      prompt: entry.prompt,
      minWords: fromKit?.minWords ?? free.minWords,
      maxWords: fromKit?.maxWords ?? 0,
      tips: fromKit?.tips ?? (entry.promptKind === 'free' ? free.tips : []),
    };
  }, [kitReady, entry.prompt, entry.promptKind, entry.storySlug]);
  const vocabulary = useMemo(() => (kitReady ? kitVocabulary(kitReady, band) : []), [kitReady, band]);

  if (kit?.status === 'loading') {
    return (
      <div className="min-h-[70svh]">
        <EntrySkeleton />
      </div>
    );
  }

  const storyGone = kit?.status === 'missing';
  const meta = [
    { label: 'Prompt', value: kindLabel(entry.promptKind) },
    ...(entry.storySlug && entry.storyTitle
      ? [
          {
            label: 'Story',
            value: storyGone ? (
              <span>
                {entry.storyTitle} <span className="font-normal text-ink-3">(this story has moved on)</span>
              </span>
            ) : (
              <Link href={`/read/${encodeURIComponent(entry.storySlug)}`} className="inline-flex min-h-11 items-center underline decoration-2 underline-offset-[5px] hover:decoration-[3px]">
                Read the story again
              </Link>
            ),
          },
        ]
      : []),
    { label: 'Started', value: timeZone ? dateLabel(entry.createdAt, now, timeZone) : '' },
  ];

  return (
    <div className="grid min-h-[70svh] content-start gap-12">
      <EntryFrame meta={<EntryMeta items={meta} />}>
        <WritingEditor
          entryId={entry.id}
          storySlug={entry.storySlug}
          storyTitle={entry.storyTitle}
          prompt={prompt}
          vocabulary={vocabulary}
          gradeBand={band}
          variant="page"
        />
      </EntryFrame>
      <div className="border-t border-line-soft pt-6 xl:ml-[calc(216px+48px)]">
        <DeleteEntry id={entry.id} />
      </div>
    </div>
  );
}

function DeleteEntry({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const keepRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button ref={triggerRef} variant="ghost" icon={<IconTrash size={18} />} onClick={() => setOpen(true)} aria-haspopup="dialog">
        Delete entry
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} modal labelledBy={headingId} closeLabel="Keep it" initialFocusRef={keepRef} returnFocusRef={triggerRef}>
        <div className="grid gap-4 pt-2 pr-12 pb-2">
          <h2 id={headingId} className="font-title text-[26px] leading-[1.15] font-bold">
            Delete this entry?
          </h2>
          <p className="text-ui text-ink-2">It’s only on this device, so it can’t come back.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                markEntryDeleted(id);
                dispatch({ type: 'deleteEntry', id });
                setOpen(false);
                toast({ message: 'Entry deleted.' });
                router.replace('/journal');
              }}
              className="max-md:w-full"
            >
              Delete entry
            </Button>
            <Button ref={keepRef} variant="secondary" onClick={() => setOpen(false)} className="max-md:w-full">
              Keep it
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
