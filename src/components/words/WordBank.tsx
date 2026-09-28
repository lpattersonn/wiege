'use client';

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';

import { IconTrash } from '@/components/glyphs/icons';
import { MarkedWord, masteryInfo } from '@/components/pen/MasteryMark';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Segmented } from '@/components/ui/Segmented';
import { toast } from '@/components/ui/Toast';
import { dispatch, useLocal } from '@/lib/local/store';
import type { LocalState, WordEntry } from '@/lib/local/schema';

import { gateScript, NO_WORDS, StoreGate } from './StoreGate';
import { useNow } from './use-now';
import { MarksLadder, MasteryLegend, WordsEmpty, WordsSkeleton } from './parts';
import {
  boxCounts,
  countDue,
  dueLabel,
  practiseAnywayLabel,
  practiseLabel,
  ROUND_SIZE,
  searchWords,
  sortWords,
  WORD_SORTS,
  type WordSort,
} from './word-bank';

/**
 * /words island (DESIGN §12.5): the saved words from this device with search,
 * sort (Due first / A–Z / Newest), due count, mastery marks and remove with
 * an Undo toast. Before hydration it is a pre-hydration gate: the empty state
 * for a device with no words, otherwise a same-size skeleton.
 */

const PAGE = 50;
const selectWords = (s: LocalState) => s.words;
const selectTimeZone = (s: LocalState) => s.prefs.timezone;

export function WordBank() {
  const record = useLocal(selectWords);
  const timeZone = useLocal(selectTimeZone);
  const now = useNow();
  if (record === null || timeZone === null || now === null) {
    return (
      <StoreGate
        id="words-gate"
        className="min-h-[70svh]"
        script={gateScript('words-gate', NO_WORDS)}
        variants={{ empty: <WordsEmpty /> }}
        fallback={<WordsSkeleton />}
      />
    );
  }
  if (Object.keys(record).length === 0) {
    return (
      <div className="min-h-[70svh]">
        <WordsEmpty />
      </div>
    );
  }
  return <WordList record={record} now={now} timeZone={timeZone} />;
}

function WordList({ record, now, timeZone }: { record: Readonly<Record<string, WordEntry>>; now: number; timeZone: string }) {
  const ids = useId();
  const words = useMemo(() => Object.values(record), [record]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<WordSort>('due');
  const [limit, setLimit] = useState(PAGE);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const focusAfterRemove = useRef<number | null>(null);
  const deferredQuery = useDeferredValue(query);

  const due = countDue(words, now);
  const counts = useMemo(() => boxCounts(words), [words]);
  const shown = useMemo(() => {
    const sorted = sortWords(words, sort);
    return deferredQuery.trim() ? searchWords(sorted, deferredQuery) : sorted;
  }, [words, sort, deferredQuery]);
  const visible = shown.slice(0, limit);

  // Keep keyboard focus in the list after a row disappears.
  useEffect(() => {
    const index = focusAfterRemove.current;
    if (index === null) return;
    focusAfterRemove.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove]');
    const target = buttons && buttons.length > 0 ? buttons[Math.min(index, buttons.length - 1)] : null;
    if (target) target.focus();
    else searchRef.current?.querySelector('input')?.focus();
  }, [words]);

  function remove(entry: WordEntry, index: number) {
    focusAfterRemove.current = index;
    dispatch({ type: 'removeWord', word: entry.word });
    toast({
      message: `Removed “${entry.word}”.`,
      action: { label: 'Undo', onAction: () => dispatch({ type: 'restoreWord', entry }) },
    });
  }

  const matches = shown.length;
  const searching = deferredQuery.trim().length > 0;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-ink-2">
          <span>
            <b className="num font-extrabold text-ink">{words.length}</b> {words.length === 1 ? 'word' : 'words'} saved
          </span>
          {due > 0 ? (
            <span>
              <b className="num font-extrabold text-ink">{due}</b> ready to practise
            </span>
          ) : (
            <span>Nothing to practise right now</span>
          )}
        </p>
        {due > 0 ? (
          <LinkButton href="/words/practice" className="max-md:w-full">
            {practiseLabel(Math.min(due, ROUND_SIZE))}
          </LinkButton>
        ) : (
          <LinkButton href="/words/practice?mode=any" variant="secondary" className="max-md:w-full">
            {practiseAnywayLabel(words.length)}
          </LinkButton>
        )}
      </div>

      <div className="grid gap-10 @5xl/app:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] @5xl/app:gap-14">
        <section aria-labelledby={`${ids}-list`} className="min-w-0">
          <h2 id={`${ids}-list`} className="sr-only">
            Saved words
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div ref={searchRef} className="min-w-0 flex-[1_1_260px]">
              <SearchInput
                label="Search your words"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(PAGE);
                }}
              />
            </div>
            <Segmented legend="Sort your words" options={WORD_SORTS} value={sort} onChange={setSort} />
          </div>
          <MasteryLegend className="mt-5 @5xl/app:hidden" />
          <p role="status" className="sr-only">
            {searching ? `${matches} ${matches === 1 ? 'word matches' : 'words match'} “${deferredQuery.trim()}”.` : ''}
          </p>
          {matches === 0 ? (
            <div className="mt-8 grid justify-items-start gap-3 border-t border-line-soft pt-6">
              <p className="text-ui text-ink-2">No saved word matches “{deferredQuery.trim()}”.</p>
              <Button variant="ghost" onClick={() => setQuery('')}>
                Clear the search
              </Button>
            </div>
          ) : (
            <ul ref={listRef} className="mt-4">
              {visible.map((entry, index) => (
                <WordRow key={entry.word} entry={entry} label={dueLabel(entry, now, timeZone)} onRemove={() => remove(entry, index)} />
              ))}
            </ul>
          )}
          {matches > visible.length ? (
            <Button variant="secondary" className="mt-6 max-md:w-full" onClick={() => setLimit((n) => n + PAGE)}>
              Show more words
              <span className="num font-normal text-ink-2">({matches - visible.length} more)</span>
            </Button>
          ) : null}
        </section>
        <aside aria-labelledby={`${ids}-marks`} className="hidden @5xl/app:block">
          <div className="sticky top-24">
            <MarksLadder counts={counts} headingId={`${ids}-marks`} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function WordRow({ entry, label, onRemove }: { entry: WordEntry; label: string; onRemove: () => void }) {
  const mastery = masteryInfo(entry.box);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-b border-line-soft py-4 md:gap-x-4">
      <p className="min-w-0 pb-1.5 font-title text-[26px] leading-[1.2] font-bold text-ink">
        <MarkedWord word={entry.word} level={entry.box} />
        {entry.partOfSpeech ? <span className="ml-2.5 font-read text-nav font-normal text-ink-3 italic">{entry.partOfSpeech}</span> : null}
        <span className="sr-only">. {mastery.label}.</span>
      </p>
      <p className="text-right text-caption font-bold whitespace-nowrap text-ink">{label}</p>
      <IconButton data-remove="" bare label={`Remove ${entry.word}`} icon={<IconTrash />} className="-mr-2.5 text-ink-2 hover:text-ink" onClick={onRemove} />
      <p className="col-span-2 mt-2 text-nav leading-[1.45] text-ink-2">{entry.definition}</p>
      {entry.storyTitle ? <p className="col-span-2 mt-1 text-caption text-ink-3">From “{entry.storyTitle}”</p> : null}
    </li>
  );
}
