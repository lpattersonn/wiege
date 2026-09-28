import type { ReactNode, Ref } from 'react';

import { IconPlus, IconSpeak, IconTick } from '@/components/glyphs/icons';
import { Button, IconButton } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';

/**
 * The inside of a word note (DESIGN §8.7), shared by <MarginNote> and
 * <WordSheet>. Presentational: data and callbacks come in as props; no
 * fetching here. Order: headword + part of speech, Say it / Rhymes with,
 * definition, In this story, example, literacy extra, then Save word and the
 * speaker button (hidden when speech is unavailable).
 */
export interface WordNoteData {
  /** Headword as shown ("rehearse", "shave off"). */
  word: string;
  /** "verb", "noun", "phrasal verb", "idiom". */
  partOfSpeech?: string;
  /** Respelling with the stressed syllable in capitals: "ri-HURSS", "PROH-tuh-type". */
  sayIt?: string;
  /** "verse" → "Rhymes with verse." */
  rhymesWith?: string;
  /** Kid-friendly, one or two sentences. */
  definition: string;
  /** How the word is used in this story (reader only). */
  inThisStory?: string;
  /** New example sentence (not a copy of the story). */
  example?: string;
  /** One literacy extra: label "Word history", "Word root", "Word family", "Figure of speech", "Idiom", "Context clue", "Oxymoron", "Another meaning". */
  extra?: { label: string; text: ReactNode };
}

export interface WordNoteContentProps {
  data: WordNoteData;
  /** Id for the headword (the sheet's aria-labelledby). */
  headwordId?: string;
  /** Ref to the headword, which takes focus when a sheet opens. */
  headwordRef?: Ref<HTMLParagraphElement>;
  /** The word is in the student's collection. */
  saved?: boolean;
  onSave?: () => void;
  /** Hide the Save button (e.g. a word that can't be saved). */
  canSave?: boolean;
  /** speechSynthesis is available. */
  canSpeak?: boolean;
  onSpeak?: () => void;
  /** Leave room for the sheet's close button beside the headword. */
  inSheet?: boolean;
  className?: string;
}

/** "ri-HURSS" → ri-<b>HURSS</b>: capitalised syllables are the stressed ones (bold, upright). */
export function SayIt({ respelling }: { respelling: string }) {
  const parts = respelling.split(/(-|\s+)/);
  return (
    <>
      {parts.map((part, i) =>
        /^[A-Z]{2,}$/.test(part) ? (
          <b key={i} className="font-semibold text-ink not-italic">
            {part}
          </b>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function WordNoteContent({ data, headwordId, headwordRef, saved = false, onSave, canSave = true, canSpeak = false, onSpeak, inSheet = false, className }: WordNoteContentProps) {
  return (
    <div className={cx('font-ui text-ui leading-normal text-ink', className)}>
      <div className={cx('flex flex-wrap items-baseline gap-x-3', inSheet && 'pr-13')}>
        <p id={headwordId} ref={headwordRef} tabIndex={-1} className="type-note-word outline-offset-4">
          {data.word}
        </p>
        {data.partOfSpeech ? <p className="font-read text-ui text-ink-3 italic">{data.partOfSpeech}</p> : null}
      </div>
      {data.sayIt || data.rhymesWith ? (
        <p className="mt-2 font-read text-ui leading-normal text-ink-2 italic">
          {data.sayIt ? (
            <>
              Say it: <SayIt respelling={data.sayIt} />.
            </>
          ) : null}
          {data.sayIt && data.rhymesWith ? ' ' : null}
          {data.rhymesWith ? <>Rhymes with {data.rhymesWith}.</> : null}
        </p>
      ) : null}
      <p className="mt-3 text-ui leading-[26px]">{data.definition}</p>
      {data.inThisStory ? (
        <p className="mt-2 text-small leading-[22px] text-ink-2">
          <b className="font-bold text-ink">In this story.</b> {data.inThisStory}
        </p>
      ) : null}
      {data.example ? <p className="mt-2 font-read text-ui leading-[26px] text-ink-2 italic">{data.example}</p> : null}
      {data.extra ? (
        <p className="mt-2 text-small leading-[22px] text-ink-3">
          <b className="font-bold text-ink">{data.extra.label}.</b> {data.extra.text}
        </p>
      ) : null}
      {(canSave && onSave) || (canSpeak && onSpeak) ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {canSave && onSave ? (
            <Button variant={saved ? 'primary' : 'secondary'} size="sm" aria-pressed={saved} onClick={onSave} icon={saved ? <IconTick /> : <IconPlus />}>
              {saved ? 'Saved to your words' : 'Save word'}
            </Button>
          ) : null}
          {canSpeak && onSpeak ? <IconButton label={`Say ${data.word} out loud`} icon={<IconSpeak />} onClick={onSpeak} /> : null}
        </div>
      ) : null}
    </div>
  );
}
