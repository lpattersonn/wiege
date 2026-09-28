'use client';

import Link from 'next/link';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { MiniTick } from '@/components/pen/marks';
import { LinkButton } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { gateScript, NO_ENTRIES, StoreGate } from '@/components/words/StoreGate';
import { useNow } from '@/components/words/use-now';
import type { CategorySlug } from '@/lib/categories';
import { getOwn, type JournalEntry, type LocalState } from '@/lib/local/schema';
import { useLocal } from '@/lib/local/store';

import { dateLabel, entryTitle, kindLabel, listEntries, wordsText } from './journal-helpers';

/**
 * /journal island (DESIGN §12.6): the student's entries, newest first, as
 * S-card rows (title Bodoni 700 22, prompt kind, word count, whether notes are
 * ready, date). Pre-hydration gate: the empty state on a device with no
 * writing, otherwise same-size skeleton rows.
 */

/** Empty journal (DESIGN §10): what lives here, and one way to start. */
export function JournalEmpty({ startHref }: { startHref: string }) {
  return (
    <EmptyState
      sketch="journal"
      title="Your writing stays here, on this device."
      action={
        <LinkButton href={startHref} variant="secondary">
          Write about today’s story
        </LinkButton>
      }
    >
      Every story ends with a short prompt. Answer one and it saves here as you type, with notes when you ask for them.
    </EmptyState>
  );
}

function JournalSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-3">
      <Skeleton width={120} height={22} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid min-h-[88px] grid-cols-[64px_minmax(0,1fr)] items-center gap-4 rounded-paper border border-line-soft p-4">
          <Skeleton width={64} height={64} />
          <div className="grid gap-2">
            <Skeleton width={`${70 - i * 12}%`} height={26} />
            <Skeleton width="55%" height={18} />
          </div>
        </div>
      ))}
    </div>
  );
}

const selectJournal = (s: LocalState) => s.journal;
const selectReads = (s: LocalState) => s.reads;
const selectTimeZone = (s: LocalState) => s.prefs.timezone;

export function JournalList({ startHref }: { startHref: string }) {
  const journal = useLocal(selectJournal);
  const reads = useLocal(selectReads);
  const timeZone = useLocal(selectTimeZone);
  const now = useNow();
  if (journal === null || reads === null || timeZone === null || now === null) {
    return (
      <StoreGate
        id="journal-gate"
        className="min-h-[60svh]"
        script={gateScript('journal-gate', NO_ENTRIES)}
        variants={{ empty: <JournalEmpty startHref={startHref} /> }}
        fallback={<JournalSkeleton />}
      />
    );
  }
  const entries = listEntries(journal);
  if (entries.length === 0) {
    return (
      <div className="min-h-[60svh]">
        <JournalEmpty startHref={startHref} />
      </div>
    );
  }
  return (
    <div className="grid min-h-[60svh] content-start gap-3">
      <p className="text-small text-ink-2">
        <b className="num font-extrabold text-ink">{entries.length}</b> {entries.length === 1 ? 'entry' : 'entries'}, newest first
      </p>
      <ul className="grid gap-3 @5xl/app:grid-cols-2">
        {entries.map((entry) => (
          <JournalRow key={entry.id} entry={entry} category={entry.storySlug ? getOwn(reads, entry.storySlug)?.category : undefined} now={now} timeZone={timeZone} />
        ))}
      </ul>
    </div>
  );
}

function JournalRow({ entry, category, now, timeZone }: { entry: JournalEntry; category?: CategorySlug; now: number; timeZone: string }) {
  const hasNotes = entry.feedback !== undefined;
  return (
    <li>
      <article
        className={cx(
          'relative grid h-full min-h-[88px] grid-cols-[64px_minmax(0,1fr)] items-center gap-4 rounded-paper border border-line-soft bg-paper p-4',
          'transition-[border-color] duration-160 hover:border-ink',
          'has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-[6px] has-[a:focus-visible]:outline-ink',
        )}
      >
        <span aria-hidden="true" className="grid size-16 place-items-center rounded-paper border border-line-soft">
          <CategoryGlyph glyph={category ?? 'quill'} size={34} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h2 className="line-clamp-2 font-title text-[22px] leading-[1.18] font-bold text-ink">
            <Link href={`/journal/${encodeURIComponent(entry.id)}`} className="no-underline after:absolute after:inset-0 after:z-1 after:content-[''] focus-visible:outline-none">
              {entryTitle(entry)}
            </Link>
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-[18px] gap-y-1 text-caption font-semibold text-ink-2">
            <span>{kindLabel(entry.promptKind)}</span>
            <span className="num">{wordsText(entry.wordCount)}</span>
            {hasNotes ? (
              <span className="inline-flex items-center gap-1.5 text-ink">
                <MiniTick size={14} />
                Notes ready
              </span>
            ) : (
              <span>No notes yet</span>
            )}
            <span className="font-normal text-ink-3">{dateLabel(entry.createdAt, now, timeZone)}</span>
          </p>
        </div>
      </article>
    </li>
  );
}
