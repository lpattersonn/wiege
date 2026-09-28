'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { MasteryMark } from './MasteryMark';
import { LOOP_INSETS, loopAspect, type PenFont } from './metrics';
import { Loop } from './PenMark';
import { closeTapWord, getOpenTapWord, openTapWord, useTapWord } from './tap-store';

/**
 * A tappable word (DESIGN §8.6): a real <button class="tap"> with a dotted
 * underline; hover makes it solid; open hides the underline and draws the
 * pen loop (on pointerdown for a mouse, so the response is under 100ms). A word
 * already in the student's collection shows its mastery mark instead of the
 * dots. Trailing punctuation shares a nowrap span, so a comma never starts a
 * line.
 *
 * Server components can render it directly (all props are serializable):
 *   <p className="type-read">… their hands know it{' '}
 *     <TapWord word="by heart" group="hero" controls="hero-note" trailing="." /></p>
 * The note controller reads `useTapWord(group)` to show the right note.
 */
export interface TapWordProps {
  /** Vocabulary key; also the visible text unless `children` is given. */
  word: string;
  children?: ReactNode;
  /** Punctuation right after the word (",", ".", "”."), kept on its line. */
  trailing?: string;
  /** Tap group shared with the note controller. */
  group?: string;
  /** Id of the margin note / sheet this word opens (aria-controls). */
  controls: string;
  /** Leitner box if the word is saved (1–5); 0/undefined when not. */
  mastery?: number;
  /** Seed scope, normally the story slug. */
  scope?: string;
  /** Text context for loop insets: reading text, display headline or standfirst. */
  context?: 'read' | 'display';
  /** Font the word is set in (for the server loop estimate). */
  font?: PenFont;
  /**
   * Landing hero only (DESIGN §6, §12.1): at 1024px and up, open this word by
   * itself 500ms after the fonts are ready, the page's one orchestrated pen
   * moment. Skipped below 1024px, when another word in the group is already
   * open, or if the student has already tapped or pressed a key.
   */
  preOpen?: boolean;
  className?: string;
}

export function TapWord({ word, children, trailing, group = 'default', controls, mastery = 0, scope = '', context = 'read', font, preOpen = false, className }: TapWordProps) {
  const instance = useId();
  const open = useTapWord(group);
  const isOpen = open?.instance === instance;
  const openedAt = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const textFont: PenFont = font ?? (context === 'display' ? 'display-900' : 'read');

  useEffect(() => {
    const el = buttonRef.current;
    if (!preOpen || !el || !window.matchMedia('(min-width: 64rem)').matches) return;
    let timer = 0;
    let cancelled = false;
    // The student acting first always wins over the orchestrated moment.
    const cancel = () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    window.addEventListener('pointerdown', cancel, { once: true, capture: true });
    window.addEventListener('keydown', cancel, { once: true, capture: true });
    document.fonts.ready.then(() => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        if (cancelled || getOpenTapWord(group) || !el.isConnected) return;
        const measured = measureAspect(el);
        setAspect(measured);
        openTapWord(group, word, el, instance, measured);
      }, 500);
    });
    return () => {
      cancel();
      window.removeEventListener('pointerdown', cancel, { capture: true });
      window.removeEventListener('keydown', cancel, { capture: true });
    };
    // Runs once per mount: the pre-open is a first-screen moment, not a reaction to later props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function measureAspect(el: HTMLElement): number | undefined {
    const size = parseFloat(getComputedStyle(el).fontSize) || 16;
    const inset = LOOP_INSETS[context];
    const w = el.offsetWidth + 2 * inset.lx * size;
    const h = el.offsetHeight + (inset.lt + inset.lb) * size;
    return h > 0 ? w / h : undefined;
  }

  function activate(el: HTMLElement) {
    const measured = measureAspect(el);
    setAspect(measured);
    openTapWord(group, word, el, instance, measured);
  }

  const saved = mastery >= 1;
  const seen = mastery >= 2;
  const label = `${word}: show what it means${seen ? ', you have met this word before' : ''}`;

  const button = (
    <button
      ref={buttonRef}
      type="button"
      className={`tap${className ? ` ${className}` : ''}`}
      data-mastery={saved ? mastery : undefined}
      aria-expanded={isOpen}
      aria-controls={controls}
      aria-label={label}
      onPointerDown={(event) => {
        // Mouse: start the loop on pointerdown (< 100ms response). Touch and pen wait for
        // the click, so a scroll that starts on a word never opens a note.
        if (event.pointerType !== 'mouse' || event.button !== 0 || isOpen) return;
        openedAt.current = event.timeStamp;
        activate(event.currentTarget);
      }}
      onClick={(event) => {
        // The click that ends the pointerdown that just opened it (a drag-off never clicks).
        if (openedAt.current && event.timeStamp - openedAt.current < 1000) {
          openedAt.current = 0;
          return;
        }
        if (isOpen) closeTapWord(group);
        else activate(event.currentTarget);
      }}
    >
      {children ?? word}
      {isOpen ? (
        <Loop key={open?.serial} word={word} scope={scope} aspect={aspect ?? loopAspect(word, textFont, context)} context={context} animate />
      ) : seen ? (
        <MasteryMark level={mastery} word={word} scope={scope} font={textFont} context={context} />
      ) : null}
    </button>
  );

  return trailing ? (
    <span className="nobr">
      {button}
      {trailing}
    </span>
  ) : (
    button
  );
}
