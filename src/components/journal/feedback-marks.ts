import type { WritingFeedback } from '@/lib/literacy/types';

/**
 * Turning writing feedback into pen marks on the draft (DESIGN §11.12).
 * Pure and isomorphic.
 *
 * - "Working" notes (glows) get a `double` underline under the phrase they
 *   quote, or a `loop` when the quote is a single word.
 * - "Try next" notes (grows) get a `caret` at a suggested insertion point: at
 *   the quoted spot when the note quotes the draft, otherwise at the end of the
 *   draft (where more writing would go).
 * - Always 2 Working notes before at most 2 Try next; never more than 4 marks.
 * Marks only point at the student's own words; the text is never changed.
 */

export type NoteKind = 'glow' | 'grow';

export interface FeedbackNote {
  /** Stable within one feedback: 'glow-0', 'grow-1'. */
  key: string;
  kind: NoteKind;
  text: string;
}

export type DraftMarkKind = 'double' | 'loop' | 'caret';

export interface DraftMark {
  noteKey: string;
  kind: DraftMarkKind;
  /** Character range in the draft; a caret has start === end. */
  start: number;
  end: number;
}

export const MAX_GLOWS = 2;
export const MAX_GROWS = 2;

/** The notes in display order: Working first, then Try next. */
export function feedbackNotes(feedback: Pick<WritingFeedback, 'glow' | 'grow'>): FeedbackNote[] {
  const glows = feedback.glow.slice(0, MAX_GLOWS).map((text, i) => ({ key: `glow-${i}`, kind: 'glow' as const, text }));
  const grows = feedback.grow.slice(0, MAX_GROWS).map((text, i) => ({ key: `grow-${i}`, kind: 'grow' as const, text }));
  return [...glows, ...grows];
}

const QUOTE = /"([^"\n]+)"|“([^”\n]+)”/g;

/** The phrases a note quotes, cleaned of ellipses and edge punctuation. */
export function extractQuotes(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(QUOTE)) {
    const raw = match[1] ?? match[2] ?? '';
    const clean = raw
      .replace(/^(?:…|\.\.\.)\s*/, '')
      .replace(/\s*(?:…|\.\.\.)$/, '')
      .replace(/^[\s"'“”‘’(]+/, '')
      .replace(/[\s"'“”‘’).,;:!?]+$/, '')
      .trim();
    if (clean) out.push(clean);
  }
  return out;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Finds `phrase` in `body`, tolerant of line breaks and repeated spaces between
 * words and of straight vs curly apostrophes. Case-sensitive first, then not.
 */
export function findPhrase(body: string, phrase: string): { start: number; end: number } | null {
  const tokens = phrase.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const source = tokens.map((t) => escapeRegExp(t).replace(/['’]/g, "['’]")).join('\\s+');
  for (const flags of ['u', 'iu']) {
    const match = new RegExp(source, flags).exec(body);
    if (match) return { start: match.index, end: match.index + match[0].length };
  }
  return null;
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start === a.end || b.start === b.end
    ? // A caret collides with a range it sits strictly inside, or with another caret at the same spot.
      (a.start === a.end && b.start === b.end && a.start === b.start) ||
      (a.start === a.end && a.start > b.start && a.start < b.end) ||
      (b.start === b.end && b.start > a.start && b.start < a.end)
    : a.start < b.end && b.start < a.end;

/** Where "add more" goes: just after the last non-space character. */
function endOfDraft(body: string): number {
  return body.replace(/\s+$/, '').length;
}

/** Plans at most 4 marks for the notes on this draft. */
export function planMarks(body: string, notes: readonly FeedbackNote[]): DraftMark[] {
  const marks: DraftMark[] = [];
  const free = (m: { start: number; end: number }) => !marks.some((other) => overlaps(m, other));
  let usedEndCaret = false;

  for (const note of notes) {
    const found = extractQuotes(note.text)
      .map((quote) => ({ quote, at: findPhrase(body, quote) }))
      .filter((q): q is { quote: string; at: { start: number; end: number } } => q.at !== null);

    if (note.kind === 'glow') {
      // Mark the longest quoted phrase that is really in the draft.
      const best = found.sort((a, b) => b.at.end - b.at.start - (a.at.end - a.at.start))[0];
      if (!best) continue;
      const single = !/\s/.test(body.slice(best.at.start, best.at.end));
      const mark: DraftMark = { noteKey: note.key, kind: single ? 'loop' : 'double', ...best.at };
      if (free(mark)) marks.push(mark);
      continue;
    }

    const pointsAtEnd = /\bend(?:s|ing)?\b/i.test(note.text);
    const target = found[0];
    let at: number;
    if (target) {
      at = pointsAtEnd ? target.at.end : target.at.start;
    } else {
      if (usedEndCaret || body.trim().length === 0) continue;
      at = endOfDraft(body);
      usedEndCaret = true;
    }
    const mark: DraftMark = { noteKey: note.key, kind: 'caret', start: at, end: at };
    if (free(mark)) marks.push(mark);
  }
  return marks.sort((a, b) => a.start - b.start || a.end - b.end);
}

export interface DraftSegment {
  text: string;
  mark?: DraftMark;
}

/** The draft cut into plain text and marked pieces (carets are empty pieces). */
export function splitDraft(body: string, marks: readonly DraftMark[]): DraftSegment[] {
  const segments: DraftSegment[] = [];
  let cursor = 0;
  for (const mark of [...marks].sort((a, b) => a.start - b.start)) {
    if (mark.start < cursor || mark.end > body.length) continue;
    if (mark.start > cursor) segments.push({ text: body.slice(cursor, mark.start) });
    segments.push({ text: body.slice(mark.start, mark.end), mark });
    cursor = mark.end;
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor) });
  return segments;
}

/** A note's sentence split into plain text and the student's quoted words. */
export function noteParts(text: string): Array<{ text: string; quoted: boolean }> {
  const parts: Array<{ text: string; quoted: boolean }> = [];
  let cursor = 0;
  for (const match of text.matchAll(QUOTE)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: text.slice(cursor, index), quoted: false });
    parts.push({ text: match[1] ?? match[2] ?? '', quoted: true });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), quoted: false });
  return parts;
}

export const RUBRIC_LABELS: ReadonlyArray<{ key: keyof WritingFeedback['rubric']; label: string; hint: string }> = [
  { key: 'ideas', label: 'Ideas', hint: 'You answer the prompt with details.' },
  { key: 'organization', label: 'Organisation', hint: 'Your ideas follow on from each other.' },
  { key: 'wordChoice', label: 'Word choice', hint: 'You pick exact, interesting words.' },
  { key: 'conventions', label: 'Capitals and punctuation', hint: 'Sentences start and end the right way.' },
];

/** Rubric score as a whole number 1–4. */
export function rubricScore(value: number): number {
  return Math.min(4, Math.max(1, Math.round(Number.isFinite(value) ? value : 1)));
}
