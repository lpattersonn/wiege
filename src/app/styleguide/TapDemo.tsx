'use client';

import { useState } from 'react';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { Folio, FolioLeft, FolioMain, FolioMargin } from '@/components/layout/PageContainer';
import { MarginNote } from '@/components/pen/MarginNote';
import { AsideArrow, WordsKeptMeter } from '@/components/pen/marks';
import { closeTapWord, useTapWord } from '@/components/pen/tap-store';
import { TapWord } from '@/components/pen/TapWord';
import { WordNoteContent, type WordNoteData } from '@/components/pen/WordNoteContent';
import { WordSheet } from '@/components/pen/WordSheet';
import { Tag } from '@/components/ui/Chip';
import { MetaItem, MetaMinutes, MetaRow } from '@/components/ui/MetaRow';
import { MEDIA, speakWord, useCanSpeak, useMediaQuery } from '@/components/ui/use-media-query';

/**
 * Reference controller for tap words (landing hero + reader). Shows the
 * pattern feature engineers follow: TapWords write to a group in the tap
 * store; one controller per group reads `useTapWord(group)` and renders the
 * note — MarginNote in the right margin at ≥ 1024, and below that either
 * inline after the block (landing) or the non-modal WordSheet (reader).
 * Saving here is local demo state; the real pages dispatch `saveWord`.
 */
const NOTES: Record<string, WordNoteData> = {
  rehearse: {
    word: 'rehearse',
    partOfSpeech: 'verb',
    sayIt: 'ri-HURSS',
    rhymesWith: 'verse',
    definition: 'To practise something again and again before you do it for real.',
    example: 'The band rehearsed the last song until the ending felt easy.',
    extra: { label: 'Word history', text: 'From an old French word meaning “to rake over the ground again”.' },
  },
  'shave off': {
    word: 'shave off',
    partOfSpeech: 'phrasal verb',
    sayIt: 'SHAYV-off',
    definition: 'To make something a tiny bit smaller, like a time or a price.',
    example: 'She shaved two seconds off her best time.',
    extra: { label: 'Figure of speech', text: 'Nobody uses a razor. Borrowing “shave” shows how thin the slice is.' },
  },
  'by heart': {
    word: 'by heart',
    partOfSpeech: 'idiom',
    sayIt: 'by HART',
    definition: 'So well that you can do it or say it without looking or thinking.',
    example: 'I know every word of that song by heart.',
    extra: { label: 'Idiom', text: 'The words add up to more than their parts. It has nothing to do with your actual heart.' },
  },
  prototype: {
    word: 'prototype',
    partOfSpeech: 'noun',
    sayIt: 'PROH-tuh-type',
    definition: 'An early, rough version of something, built to test an idea before you make the real thing.',
    example: 'Our first prototype of the robot could only turn left.',
    extra: {
      label: 'Word root',
      text: (
        <>
          From Greek <i lang="el">protos</i>, meaning first.
        </>
      ),
    },
  },
  collaborate: {
    word: 'collaborate',
    partOfSpeech: 'verb',
    sayIt: 'kuh-LAB-uh-rate',
    definition: 'To work together on the same thing, sharing the jobs and the decisions.',
    example: 'Two artists collaborated on the cover.',
    extra: { label: 'Word root', text: 'Latin col (together) and laborare (to work).' },
  },
  narrative: {
    word: 'narrative',
    partOfSpeech: 'noun',
    sayIt: 'NARR-uh-tiv',
    definition: 'The story, and the way it is told: who it is about, what happens and in what order.',
    inThisStory: 'Priya means the story of the keeper matters more than how the game looks.',
    example: 'The game’s narrative made me care about a pixel lighthouse.',
    extra: { label: 'Word family', text: 'narrator, narrate, narration.' },
  },
};

const HERO_WORDS = ['rehearse', 'shave off', 'by heart'];

function useSaved() {
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const toggle = (word: string) => {
    const had = saved.has(word);
    const next = new Set(saved);
    if (had) next.delete(word);
    else next.add(word);
    setSaved(next);
    setLastSaved(had ? null : word);
  };
  return { saved, toggle, lastSaved };
}

export function HeroTapDemo() {
  const group = 'sg-hero';
  const noteId = 'sg-hero-note';
  const open = useTapWord(group);
  const wide = useMediaQuery(MEDIA.lg);
  const canSpeak = useCanSpeak() === true;
  const { saved, toggle, lastSaved } = useSaved();
  const data = open ? NOTES[open.word] : null;
  const kept = HERO_WORDS.filter((w) => saved.has(w)).length;
  const inlineBlock = open ? (open.word === 'by heart' ? 'standfirst' : 'headline') : null;

  const note = (
    <MarginNote
      id={noteId}
      open={Boolean(data)}
      anchor={open?.anchor}
      placement={wide ? 'margin' : 'inline'}
      animate
      swapKey={open?.serial}
    >
      {data ? <WordNoteContent data={data} saved={saved.has(data.word)} onSave={() => toggle(data.word)} canSpeak={canSpeak} onSpeak={() => speakWord(data.word)} /> : null}
    </MarginNote>
  );

  return (
    <Folio>
      <FolioLeft>
        <p className="type-lead-ui max-w-[30ch]">Tap a dotted word. The pen circles it and writes the note in the margin.</p>
        <p aria-hidden="true" className="mt-10 hidden flex-col items-start xl:flex">
     <span className="type-hand">try it: tap a dotted word</span>
          <AsideArrow direction="right" className="mt-[-2px] ml-20" />
        </p>
      </FolioLeft>
      <FolioMain>
        <MetaRow>
          <Tag>Practice story</Tag>
          <MetaItem strong icon={<CategoryGlyph glyph="games" size={22} strokeWidth={1.7} />}>
            Games
          </MetaItem>
          <MetaMinutes minutes={3} />
          <MetaItem>Grade 7–8</MetaItem>
        </MetaRow>
        <p className="mt-4 type-display-xl">
          Speedrunners <TapWord word="rehearse" group={group} controls={noteId} context="display" scope="sg" preOpen /> one jump hundreds of times to{' '}
          <TapWord word="shave off" group={group} controls={noteId} context="display" scope="sg" /> a single second
        </p>
        {!wide && inlineBlock === 'headline' ? note : null}
        <p className="mt-6 type-standfirst">
          A speedrun is a race to finish a game as fast as possible, and the clock never lies. Runners study a level frame by frame, then practise
          the hardest trick until their hands know it <TapWord word="by heart" group={group} controls={noteId} trailing="." scope="sg" />
        </p>
        {!wide && inlineBlock === 'standfirst' ? note : null}
        <WordsKeptMeter kept={kept} className="mt-6" animateIndex={lastSaved && HERO_WORDS.includes(lastSaved) ? kept - 1 : undefined} />
      </FolioMain>
      <FolioMargin>{wide || !inlineBlock ? note : null}</FolioMargin>
    </Folio>
  );
}

export function ReaderTapDemo() {
  const group = 'sg-reader';
  const noteId = 'sg-reader-note';
  const open = useTapWord(group);
  const wide = useMediaQuery(MEDIA.lg);
  const canSpeak = useCanSpeak() === true;
  const { saved, toggle } = useSaved();
  const data = open ? NOTES[open.word] : null;
  const tapProps = { group, controls: noteId, scope: 'sg-reader' } as const;

  return (
    <Folio>
      <FolioLeft>
        <p className="text-small font-bold text-ink-2">Reader: margin note from 1024px, the word sheet below it.</p>
      </FolioLeft>
      <FolioMain>
        <div className="type-read" style={{ paddingBottom: 'var(--sheet-h, 0px)' }}>
          <p>
            It started as a science project about how light bends. Then Theo, 13, sketched a lighthouse keeper who guides ships home using nothing
            but mirrors. Their first <TapWord word="prototype" {...tapProps} /> was made of cardboard, a bike torch and a lot of arguing.
          </p>
          <p className="mt-[1.1em]">
            Over six months the team learned to <TapWord word="collaborate" mastery={2} trailing=":" {...tapProps} /> Priya wrote the story, Jonah
            built the levels and Ada composed the music. “The <TapWord word="narrative" mastery={3} {...tapProps} /> matters more than the
            graphics,” Priya says.
          </p>
        </div>
      </FolioMain>
      <FolioMargin>
        {wide ? (
          <MarginNote id={noteId} open={Boolean(data)} anchor={open?.anchor} placement="margin" animate swapKey={open?.serial}>
            {data ? <WordNoteContent data={data} saved={saved.has(data.word)} onSave={() => toggle(data.word)} canSpeak={canSpeak} onSpeak={() => speakWord(data.word)} /> : null}
          </MarginNote>
        ) : (
          <WordSheet
            id={noteId}
            open={Boolean(data)}
            onClose={() => closeTapWord(group, { returnFocus: true })}
            data={data}
            saved={data ? saved.has(data.word) : false}
            onSave={data ? () => toggle(data.word) : undefined}
            canSpeak={canSpeak}
            onSpeak={data ? () => speakWord(data.word) : undefined}
          />
        )}
      </FolioMargin>
    </Folio>
  );
}
