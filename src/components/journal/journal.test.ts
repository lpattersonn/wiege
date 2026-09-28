import { describe, expect, it } from 'vitest';

import type { JournalEntry } from '@/lib/local/schema';
import { heuristicFeedback } from '@/lib/literacy/feedback-core';

import { extractQuotes, feedbackNotes, findPhrase, noteParts, planMarks, rubricScore, splitDraft } from './feedback-marks';
import {
  dateLabel,
  draftOpening,
  entryTitle,
  findResumableEntry,
  freePrompt,
  kindLabel,
  listEntries,
  newEntryId,
  targetState,
  targetText,
  toJournalKind,
  wordTarget,
  wordsText,
} from './journal-helpers';

const NOW = Date.UTC(2026, 8, 27, 10, 0, 0);
const TZ = 'Europe/Berlin';

function entry(id: string, over: Partial<JournalEntry> = {}): JournalEntry {
  return { id, promptKind: 'free', prompt: 'P', body: 'Some words here.', wordCount: 3, createdAt: NOW, updatedAt: NOW, ...over };
}

describe('journal helpers', () => {
  it('maps prompt kinds', () => {
    expect(toJournalKind('opinion')).toBe('opinion');
    expect(toJournalKind('poem')).toBe('free');
    expect(kindLabel('creative')).toBe('Creative writing');
    expect(kindLabel('free')).toBe('Free write');
  });

  it('normalises word targets and describes them', () => {
    expect(wordTarget({ minWords: 30, maxWords: 80 })).toEqual({ min: 30, max: 80 });
    expect(wordTarget(freePrompt())).toEqual({ min: 50, max: null });
    expect(wordTarget({ minWords: 60, maxWords: 20 })).toEqual({ min: 60, max: null });
    expect(targetText({ min: 30, max: 80 })).toBe('aim for 30 to 80');
    expect(targetText({ min: 50, max: null })).toBe('aim for 50 or more');
    expect(targetState(0, { min: 30, max: 80 })).toBe('empty');
    expect(targetState(10, { min: 30, max: 80 })).toBe('short');
    expect(targetState(50, { min: 30, max: 80 })).toBe('in-range');
    expect(targetState(90, { min: 30, max: 80 })).toBe('long');
    expect(targetState(900, { min: 30, max: null })).toBe('in-range');
    expect(wordsText(1)).toBe('1 word');
    expect(wordsText(38)).toBe('38 words');
  });

  it('titles entries by story, else by their opening', () => {
    expect(entryTitle({ storyTitle: 'The relay team', body: 'x', promptKind: 'summary' })).toBe('The relay team');
    expect(entryTitle({ body: 'Today I watched   the first snow fall over the whole town.', promptKind: 'free' })).toBe('Today I watched the first snow fall over…');
    expect(entryTitle({ body: '  ', promptKind: 'free' })).toBe('Free write');
    expect(draftOpening('Short one.')).toBe('Short one.');
  });

  it('lists entries with writing, newest first', () => {
    const journal = {
      a: entry('a', { createdAt: 1 }),
      b: entry('b', { createdAt: 3 }),
      c: entry('c', { createdAt: 2, body: '   ' }),
    };
    expect(listEntries(journal).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('resumes the latest entry for the same story prompt only', () => {
    const journal = {
      old: entry('old', { storySlug: 's', prompt: 'Summarise it.', updatedAt: 1 }),
      recent: entry('recent', { storySlug: 's', prompt: 'Summarise it.', updatedAt: 5 }),
      other: entry('other', { storySlug: 's', prompt: 'Another prompt.', updatedAt: 9 }),
    };
    expect(findResumableEntry(journal, 's', 'Summarise it.')?.id).toBe('recent');
    expect(findResumableEntry(journal, undefined, 'Summarise it.')).toBeNull();
    expect(findResumableEntry(journal, 'x', 'Summarise it.')).toBeNull();
    // "constructor" is a legitimate key, not Object.prototype.constructor.
    expect(findResumableEntry({ constructor: entry('constructor', { storySlug: 's', prompt: 'P' }) }, 's', 'P')?.id).toBe('constructor');
  });

  it('makes unique, key-safe ids', () => {
    const a = newEntryId();
    const b = newEntryId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('labels dates in the student’s time zone', () => {
    expect(dateLabel(NOW, NOW, TZ)).toBe('Today');
    expect(dateLabel(NOW - 86_400_000, NOW, TZ)).toBe('Yesterday');
    expect(dateLabel(Date.UTC(2026, 8, 12, 12), NOW, TZ)).toBe('12 Sept');
    expect(dateLabel(Date.UTC(2025, 8, 12, 12), NOW, TZ)).toBe('12 Sept 2025');
  });
});

describe('feedback marks', () => {
  it('extracts quoted phrases, straight or curly, without ellipses', () => {
    expect(extractQuotes('You used the story word "rehearse" in "…we rehearse every day".')).toEqual(['rehearse', 'we rehearse every day']);
    expect(extractQuotes('Your opening “The map was old…” works.')).toEqual(['The map was old']);
    expect(extractQuotes('No quotes here.')).toEqual([]);
  });

  it('finds phrases across line breaks and apostrophe styles', () => {
    const body = 'It was late.\nWe didn’t   stop running.';
    expect(findPhrase(body, "We didn't stop")).toEqual({ start: 13, end: 29 });
    expect(findPhrase(body, 'it was LATE')).toEqual({ start: 0, end: 11 });
    expect(findPhrase(body, 'not here')).toBeNull();
  });

  it('plans at most one mark per note, glows on quotes and carets for grows', () => {
    const body = 'The team kept going. They rehearse every morning before school starts';
    const notes = feedbackNotes({
      glow: ['You used the story word "rehearse" in "They rehearse every morning".', 'Your opening "The team kept going" is clear.', 'extra'],
      grow: ['End every sentence with a full stop. Check the one ending "before school starts".', 'Add one more specific detail from the story.', 'extra'],
    });
    expect(notes.map((n) => n.key)).toEqual(['glow-0', 'glow-1', 'grow-0', 'grow-1']);
    const marks = planMarks(body, notes);
    expect(marks).toHaveLength(3);
    expect(marks[0]).toMatchObject({ noteKey: 'glow-1', kind: 'double', start: 0, end: 19 });
    expect(marks[1]).toMatchObject({ noteKey: 'glow-0', kind: 'double' });
    // The missing full stop goes at the end of the quoted sentence; the second
    // grow's end-of-draft caret would land on the same spot, so it is dropped.
    expect(marks[2]).toMatchObject({ noteKey: 'grow-0', kind: 'caret', start: body.length, end: body.length });
  });

  it('loops single words and never overlaps marks', () => {
    const body = 'Stamina matters. Stamina is everything.';
    const marks = planMarks(body, [
      { key: 'glow-0', kind: 'glow', text: 'You used "Stamina".' },
      { key: 'glow-1', kind: 'glow', text: 'Again "Stamina matters".' },
    ]);
    expect(marks).toEqual([{ noteKey: 'glow-0', kind: 'loop', start: 0, end: 7 }]);
  });

  it('splits the draft around marks without changing the text', () => {
    const body = 'One two three four.';
    const marks = planMarks(body, [
      { key: 'glow-0', kind: 'glow', text: 'Nice: "two three".' },
      { key: 'grow-0', kind: 'grow', text: 'Add a detail.' },
    ]);
    const segments = splitDraft(body, marks);
    expect(segments.map((s) => s.text).join('')).toBe(body);
    expect(segments.filter((s) => s.mark).map((s) => s.mark?.kind)).toEqual(['double', 'caret']);
  });

  it('marks real heuristic feedback on a real draft', () => {
    const text = 'The lighthouse game started as a science project. Theo sketched a keeper who guides ships home with mirrors. I think it is clever because it teaches how light bends.';
    const feedback = heuristicFeedback({ prompt: 'What do you think of the game?', text, gradeBand: '7-8', vocabulary: ['prototype', 'keeper'], minWords: 20, maxWords: 80, promptKind: 'opinion' });
    const marks = planMarks(text, feedbackNotes(feedback));
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.length).toBeLessThanOrEqual(4);
    for (const mark of marks) {
      expect(mark.start).toBeGreaterThanOrEqual(0);
      expect(mark.end).toBeLessThanOrEqual(text.length);
    }
  });

  it('splits notes into plain text and quotes', () => {
    expect(noteParts('You open with "The map", which works.')).toEqual([
      { text: 'You open with ', quoted: false },
      { text: 'The map', quoted: true },
      { text: ', which works.', quoted: false },
    ]);
  });

  it('clamps rubric scores', () => {
    expect(rubricScore(0)).toBe(1);
    expect(rubricScore(3.4)).toBe(3);
    expect(rubricScore(9)).toBe(4);
    expect(rubricScore(Number.NaN)).toBe(1);
  });
});
