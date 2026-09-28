import { normalizeWordToken, sameWordFamily } from '@/lib/literacy/word-forms';

import { sentenceAround } from './text';

/**
 * Splits a retelling into plain text and vocabulary words (SPEC §8, DESIGN
 * §8.6), on the server. Vocabulary is matched without regard to case, on
 * whole words (heuristic lessons store lower-case words, Claude and practice
 * lessons keep the text's case), falling back to another form of the word
 * ("collaborated" for "collaborate"). Only the first place a word appears in
 * a level becomes a tap button; a tap anywhere else still finds it.
 *
 * Isomorphic and pure (unit-tested); the page calls it at render time.
 */

export interface TextSegment {
  kind: 'text';
  text: string;
}

export interface WordSegment {
  kind: 'word';
  /** Vocabulary key, as the lesson spells it. */
  key: string;
  /** The word as written in the story. */
  text: string;
  /** Opening punctuation right before the word ("“"), kept on its line. */
  leading: string;
  /** Punctuation right after the word (",", "”."), kept on its line. */
  trailing: string;
}

export type Segment = TextSegment | WordSegment;

interface Match {
  key: string;
  start: number;
  end: number;
}

const TOKEN = new RegExp("[\\p{L}\\p{M}\\p{N}]+(?:['’][\\p{L}\\p{M}\\p{N}]+)*", 'gu');
const NOT_WORD = '[^\\p{L}\\p{M}\\p{N}]';
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEADING = /[“‘"'([]+$/;
const TRAILING = /^[,.;:!?…)\]}”’"']+/;

/** First whole-word occurrence of `key` in `text` from `from`, as [start, end). */
export function findWord(text: string, key: string): [number, number] | null {
  const wanted = key.trim();
  if (!wanted) return null;
  if (/\s/.test(wanted)) {
    // Multi-word items ("by heart"): any whitespace between the parts.
    const pattern = new RegExp(`(^|${NOT_WORD})(${wanted.split(/\s+/).map(escapeRegExp).join('\\s+')})(?=$|${NOT_WORD})`, 'iu');
    const match = pattern.exec(text);
    return match ? [match.index + match[1].length, match.index + match[1].length + match[2].length] : null;
  }
  const target = normalizeWordToken(wanted);
  let family: [number, number] | null = null;
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(text)) !== null) {
    const token = match[0];
    const range: [number, number] = [match.index, match.index + token.length];
    if (normalizeWordToken(token) === target) {
      // "keeper’s" for "keeper": the possessive stays part of the tap word.
      return range;
    }
    if (!family && token.length >= 3 && sameWordFamily(token, wanted)) family = range;
  }
  return family;
}

/**
 * Segments every paragraph of one level. Each vocabulary key becomes a tap
 * word at its first occurrence in the level; overlapping matches keep the
 * earlier (then longer) one.
 */
export function segmentLevel(paragraphs: readonly string[], vocabulary: readonly string[]): Segment[][] {
  const perParagraph: Match[][] = paragraphs.map(() => []);
  // Longer items first, so "by heart" wins over "heart".
  const keys = [...new Set(vocabulary.map((v) => v.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const key of keys) {
    for (let p = 0; p < paragraphs.length; p++) {
      const taken = perParagraph[p];
      const hit = findWord(paragraphs[p], key);
      if (!hit) continue;
      if (taken.some((m) => hit[0] < m.end && m.start < hit[1])) continue;
      taken.push({ key, start: hit[0], end: hit[1] });
      break;
    }
  }
  return paragraphs.map((text, p) => toSegments(text, perParagraph[p].sort((a, b) => a.start - b.start)));
}

function toSegments(text: string, matches: readonly Match[]): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  for (const m of matches) {
    let start = m.start;
    let end = m.end;
    const before = text.slice(cursor, start);
    const lead = LEADING.exec(before);
    // Opening punctuation joins the word only when it opens it (“narrative, not don’t).
    const leadAt = lead ? cursor + lead.index : -1;
    const leading = lead && (leadAt === 0 || /\s/.test(text[leadAt - 1])) ? lead[0] : '';
    start -= leading.length;
    const trail = TRAILING.exec(text.slice(end));
    const trailing = trail ? trail[0] : '';
    end += trailing.length;
    if (start > cursor) out.push({ kind: 'text', text: text.slice(cursor, start) });
    out.push({ kind: 'word', key: m.key, text: text.slice(m.start, m.end), leading, trailing });
    cursor = end;
  }
  if (cursor < text.length) out.push({ kind: 'text', text: text.slice(cursor) });
  return out;
}

/** The sentence where `key` first appears in a level, for the note's "In this story" line. */
export function firstSentenceWith(paragraphs: readonly string[], key: string): string | null {
  for (const text of paragraphs) {
    const hit = findWord(text, key);
    if (hit) return sentenceAround(text, hit[0]);
  }
  return null;
}
