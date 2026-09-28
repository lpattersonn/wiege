'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { rangeFromOffsets } from './dom';

/**
 * Read-aloud with the Web Speech API (SPEC §8, DESIGN §11.20). The story is
 * spoken a sentence at a time (long utterances stall in some browsers), and
 * the word being spoken is inverted with the CSS Custom Highlight API
 * (`::highlight(wiege-listen)`) where the browser supports it. Nothing is
 * sent anywhere: the device's own voice does the reading.
 */

export type ListenState = 'idle' | 'playing' | 'paused';

const HIGHLIGHT = 'wiege-listen';
const TRAILING_PUNCTUATION = new RegExp("[^\\p{L}\\p{N}'’-]+$", 'u');

interface Chunk {
  paragraph: HTMLElement;
  /** Offset of the chunk in the paragraph's text. */
  offset: number;
  text: string;
}

type HighlightRegistry = { set: (name: string, highlight: unknown) => void; delete: (name: string) => void };
type HighlightCtor = new (...ranges: Range[]) => unknown;

function registry(): { highlights: HighlightRegistry; Highlight: HighlightCtor } | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  const Highlight = (globalThis as { Highlight?: HighlightCtor }).Highlight;
  return css?.highlights && Highlight ? { highlights: css.highlights, Highlight } : null;
}

function clearHighlight() {
  registry()?.highlights.delete(HIGHLIGHT);
}

/** Sentences of a paragraph with their offsets. */
function chunksOf(paragraph: HTMLElement): Chunk[] {
  const text = paragraph.textContent ?? '';
  const out: Chunk[] = [];
  const sentence = /[^.!?…]+(?:[.!?…]+["'”’)]*|$)\s*/g;
  let match: RegExpExecArray | null;
  while ((match = sentence.exec(text)) !== null) {
    if (!match[0]) break;
    if (match[0].trim()) out.push({ paragraph, offset: match.index, text: match[0] });
  }
  return out;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('en'));
  return voices.find((v) => v.localService && /en-gb/i.test(v.lang)) ?? voices.find((v) => v.localService) ?? voices[0];
}

export function useListen({ getParagraphs, rate }: { getParagraphs: () => HTMLElement[]; rate: number }) {
  const [state, setState] = useState<ListenState>('idle');
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    clearHighlight();
    setState('idle');
  }, []);

  const start = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const id = ++run.current;
    const chunks = getParagraphs().flatMap(chunksOf);
    const voice = pickVoice();
    const reg = registry();
    let i = 0;

    const speakNext = () => {
      if (run.current !== id) return;
      if (i >= chunks.length) {
        clearHighlight();
        setState('idle');
        return;
      }
      const chunk = chunks[i++];
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.rate = rate;
      utterance.lang = voice?.lang ?? 'en-GB';
      if (voice) utterance.voice = voice;
      utterance.onboundary = (event) => {
        if (run.current !== id || event.name !== 'word' || !reg) return;
        const from = chunk.offset + event.charIndex;
        const rest = chunk.text.slice(event.charIndex);
        const length = event.charLength || (/^\S+/.exec(rest)?.[0].replace(TRAILING_PUNCTUATION, '').length ?? 0);
        const range = length ? rangeFromOffsets(chunk.paragraph, from, from + length) : null;
        if (range) reg.highlights.set(HIGHLIGHT, new reg.Highlight(range));
      };
      utterance.onstart = () => {
        if (run.current !== id) return;
        const box = chunk.paragraph.getBoundingClientRect();
        if (box.top > window.innerHeight * 0.7 || box.bottom < 120) chunk.paragraph.scrollIntoView({ block: 'center', behavior: 'smooth' });
      };
      utterance.onend = speakNext;
      utterance.onerror = (event) => {
        // "interrupted"/"canceled" come from stop(); anything else ends the reading quietly.
        if (event.error !== 'interrupted' && event.error !== 'canceled' && run.current === id) {
          clearHighlight();
          setState('idle');
        }
      };
      synth.speak(utterance);
    };

    setState('playing');
    speakNext();
  }, [getParagraphs, rate]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setState('playing');
  }, []);

  // Leaving the page stops the voice.
  useEffect(
    () => () => {
      run.current += 1;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      clearHighlight();
    },
    [],
  );

  return { state, start, pause, resume, stop };
}
