import { describe, expect, it } from 'vitest';

import type { WritingFeedback } from '@/lib/literacy/types';
import { startOfDay } from '@/lib/time';

import { isSaveableWord, LocalActionSchema, reduceLocalState, type LocalAction } from './reducers';
import { createInitialState, LIMITS, LocalStateSchema, type LocalState, type WordEntry } from './schema';

const ZONE = 'Europe/Berlin';
const T0 = Date.parse('2026-09-27T08:00:00Z'); // 10:00 in Berlin
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const story = (slug: string, category: 'writing' | 'games' | 'art' | 'sports' = 'art') =>
  ({ slug, title: `Story ${slug}`, category, level: '7-8' }) as const;

function fresh(): LocalState {
  return createInitialState(T0 - DAY, ZONE);
}

/** Applies actions in order at the given times and returns the final result plus all events. */
function run(state: LocalState, steps: Array<[LocalAction, number]>) {
  let current = state;
  const events = [];
  for (const [action, now] of steps) {
    const result = reduceLocalState(current, action, now);
    current = result.state;
    events.push(result.events);
  }
  return { state: current, events };
}

const feedback: WritingFeedback = {
  glow: ['a', 'b'],
  grow: ['c', 'd'],
  nextStep: 'e',
  rubric: { ideas: 3, organization: 3, wordChoice: 2, conventions: 4 },
  usedVocabulary: [],
  stats: { words: 3, sentences: 1, avgSentenceLength: 3, uniqueWordRatio: 1, longWords: 0 },
  generator: 'heuristic',
};

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('reduceLocalState', () => {
  it('keeps every produced state valid against the schema', () => {
    const { state } = run(fresh(), [
      [{ type: 'startRead', ...story('s1') }, T0],
      [{ type: 'submitQuiz', ...story('s1'), score: 5, total: 5, answers: [0, 1, 2, 3, 0] }, T0 + 1],
      [{ type: 'saveWord', word: 'Resilient', definition: 'able to recover', storySlug: 's1' }, T0 + 2],
      [{ type: 'reviewWord', word: 'resilient', grade: 'good' }, T0 + 3],
      [{ type: 'saveEntry', entry: { id: 'e1', promptKind: 'free', prompt: '', body: words(60) } }, T0 + 4],
      [{ type: 'setPrefs', prefs: { gradeBand: '9-10', theme: 'dark' } }, T0 + 5],
    ]);
    expect(LocalStateSchema.safeParse(state).success).toBe(true);
  });

  describe('reading', () => {
    it('startRead records a story once and updates only its level', () => {
      const a = reduceLocalState(fresh(), { type: 'startRead', ...story('s1') }, T0);
      expect(a.state.reads.s1).toEqual({ title: 'Story s1', category: 'art', level: '7-8', startedAt: T0 });
      expect(a.events).toEqual({ xpGained: 0, newBadges: [], levelUp: null });
      const again = reduceLocalState(a.state, { type: 'startRead', ...story('s1') }, T0 + HOUR);
      expect(again.state).toBe(a.state);
      const level = reduceLocalState(a.state, { type: 'startRead', ...story('s1'), level: '9-10' }, T0 + HOUR);
      expect(level.state.reads.s1).toMatchObject({ level: '9-10', startedAt: T0 });
    });

    it('completeRead gives +10 and the first-story stamp once', () => {
      const first = reduceLocalState(fresh(), { type: 'completeRead', ...story('s1') }, T0);
      expect(first.events.xpGained).toBe(10);
      expect(first.events.newBadges).toEqual(['first-story']);
      expect(first.state.xp).toBe(10);
      expect(first.state.reads.s1.completedAt).toBe(T0);
      expect(first.state.longestStreak).toBe(1);

      const repeat = reduceLocalState(first.state, { type: 'completeRead', ...story('s1') }, T0 + HOUR);
      expect(repeat.state).toBe(first.state);
      expect(repeat.events.xpGained).toBe(0);
    });

    it('re-reading a finished story on a later day counts for the streak without XP', () => {
      const first = reduceLocalState(fresh(), { type: 'completeRead', ...story('s1') }, T0);
      const next = reduceLocalState(first.state, { type: 'completeRead', ...story('s1') }, T0 + DAY);
      expect(next.events.xpGained).toBe(0);
      expect(next.state.xp).toBe(10);
      expect(next.state.activity.at(-1)).toMatchObject({ kind: 'read', xp: 0, day: '2026-09-28' });
      expect(next.state.longestStreak).toBe(2);
    });

    it('submitQuiz completes the story and scores only the first attempt, keeping the best result', () => {
      const first = reduceLocalState(fresh(), { type: 'submitQuiz', ...story('s1'), score: 3, total: 5, answers: [0, 1, 1, 2, 3] }, T0);
      expect(first.events.xpGained).toBe(10 + 15);
      expect(first.state.reads.s1.quiz).toEqual({ score: 3, total: 5, answers: [0, 1, 1, 2, 3] });

      const retake = reduceLocalState(first.state, { type: 'submitQuiz', ...story('s1'), score: 5, total: 5, answers: [0, 0, 0, 0, 0] }, T0 + 1);
      expect(retake.events.xpGained).toBe(0);
      expect(retake.state.xp).toBe(25);
      expect(retake.state.reads.s1.quiz?.score).toBe(5);
      expect(retake.events.newBadges).toEqual(['perfect-quiz']);

      const worse = reduceLocalState(retake.state, { type: 'submitQuiz', ...story('s1'), score: 1, total: 5, answers: [1, 1, 1, 1, 1] }, T0 + 2);
      expect(worse.state.reads.s1.quiz?.score).toBe(5);
    });

    it('a perfect first quiz earns 10 + 25 + 5 bonus and the perfect-quiz stamp', () => {
      const result = reduceLocalState(fresh(), { type: 'submitQuiz', ...story('s1'), score: 5, total: 5, answers: [0, 1, 2, 3, 0] }, T0);
      expect(result.events.xpGained).toBe(40);
      expect(result.events.newBadges).toEqual(['first-story', 'perfect-quiz']);
    });

    it('rejects impossible scores', () => {
      const state = fresh();
      expect(reduceLocalState(state, { type: 'submitQuiz', ...story('s1'), score: 6, total: 5, answers: [] }, T0).state).toBe(state);
    });

    it('awards all-four after a finished story in every category', () => {
      const { state, events } = run(fresh(), [
        [{ type: 'completeRead', ...story('a', 'art') }, T0],
        [{ type: 'completeRead', ...story('b', 'games') }, T0 + 1],
        [{ type: 'completeRead', ...story('c', 'sports') }, T0 + 2],
        [{ type: 'completeRead', ...story('d', 'writing') }, T0 + 3],
      ]);
      expect(events[3].newBadges).toEqual(['all-four']);
      expect(state.badges['all-four']).toEqual({ awardedAt: T0 + 3 });
    });
  });

  describe('words', () => {
    it('saves a word once, normalising its key, due immediately in box 1', () => {
      const saved = reduceLocalState(fresh(), { type: 'saveWord', word: ' Resilient ', definition: ' able to recover ', example: '', storyTitle: 'T' }, T0);
      expect(saved.state.words.resilient).toEqual({
        word: 'Resilient',
        definition: 'able to recover',
        storyTitle: 'T',
        box: 1,
        dueAt: T0,
        reviews: 0,
        lapses: 0,
        createdAt: T0,
      });
      expect(saved.events).toMatchObject({ xpGained: 2, newBadges: ['first-word'] });
      const again = reduceLocalState(saved.state, { type: 'saveWord', word: 'RESILIENT', definition: 'x' }, T0 + 1);
      expect(again.state).toBe(saved.state);
    });

    it('caps saved-word XP at 10 a day and resets the next day', () => {
      const steps: Array<[LocalAction, number]> = Array.from({ length: 7 }, (_, i) => [
        { type: 'saveWord', word: `alpha${i}`, definition: 'd' },
        T0 + i,
      ]);
      const today = run(fresh(), steps);
      expect(today.state.xp).toBe(10);
      expect(Object.keys(today.state.words)).toHaveLength(7);
      const tomorrow = reduceLocalState(today.state, { type: 'saveWord', word: 'beta', definition: 'd' }, T0 + DAY);
      expect(tomorrow.events.xpGained).toBe(2);
    });

    it('does not pay twice for removing and re-saving the same word', () => {
      const { state } = run(fresh(), [
        [{ type: 'saveWord', word: 'gamma', definition: 'd' }, T0],
        [{ type: 'removeWord', word: 'gamma' }, T0 + 1],
        [{ type: 'saveWord', word: 'gamma', definition: 'd' }, T0 + DAY],
      ]);
      expect(state.xp).toBe(2);
      expect(state.words.gamma).toBeDefined();
    });

    it('removeWord and restoreWord round-trip the exact record', () => {
      const saved = reduceLocalState(fresh(), { type: 'saveWord', word: 'delta', definition: 'd' }, T0).state;
      const entry = saved.words.delta as WordEntry;
      const removed = reduceLocalState(saved, { type: 'removeWord', word: 'Delta' }, T0 + 1).state;
      expect(removed.words).toEqual({});
      expect(reduceLocalState(removed, { type: 'removeWord', word: 'delta' }, T0 + 2).state).toBe(removed);
      const restored = reduceLocalState(removed, { type: 'restoreWord', entry }, T0 + 3);
      expect(restored.state.words.delta).toEqual(entry);
      expect(restored.events.xpGained).toBe(0);
      expect(reduceLocalState(restored.state, { type: 'restoreWord', entry }, T0 + 4).state).toBe(restored.state);
    });

    it('treats words like "constructor" as ordinary keys', () => {
      const state = fresh();
      expect(reduceLocalState(state, { type: 'removeWord', word: 'constructor' }, T0).state).toBe(state);
      expect(reduceLocalState(state, { type: 'reviewWord', word: 'toString', grade: 'good' }, T0).state).toBe(state);
      const saved = reduceLocalState(state, { type: 'saveWord', word: 'constructor', definition: 'a builder' }, T0);
      expect(Object.keys(saved.state.words)).toEqual(['constructor']);
      expect(LocalStateSchema.safeParse(saved.state).success).toBe(true);
    });

    it('only saves single words', () => {
      expect(isSaveableWord('well-known')).toBe(true);
      expect(isSaveableWord("don't")).toBe(true);
      expect(isSaveableWord('two words')).toBe(false);
      expect(isSaveableWord('__proto__')).toBe(false);
      expect(isSaveableWord('')).toBe(false);
      const state = fresh();
      expect(reduceLocalState(state, { type: 'saveWord', word: 'two words', definition: 'd' }, T0).state).toBe(state);
    });

    it('reviewWord reschedules with Leitner rules and caps review XP at 20 a day', () => {
      let state = reduceLocalState(fresh(), { type: 'saveWord', word: 'epsilon', definition: 'd' }, T0).state;
      const good = reduceLocalState(state, { type: 'reviewWord', word: 'epsilon', grade: 'good' }, T0 + 1);
      expect(good.state.words.epsilon).toMatchObject({ box: 2, reviews: 1, dueAt: startOfDay('2026-09-28', ZONE) });
      expect(good.events.xpGained).toBe(1);
      const again = reduceLocalState(good.state, { type: 'reviewWord', word: 'epsilon', grade: 'again' }, T0 + 2);
      expect(again.state.words.epsilon).toMatchObject({ box: 1, lapses: 1, dueAt: T0 + 2 });

      state = again.state;
      let reviewXp = 2;
      for (let i = 0; i < 30; i++) {
        const r = reduceLocalState(state, { type: 'reviewWord', word: 'epsilon', grade: 'again' }, T0 + 10 + i);
        reviewXp += r.events.xpGained;
        state = r.state;
      }
      expect(reviewXp).toBe(20);
      expect(state.words.epsilon.reviews).toBe(32);
      expect(state.activity.filter((a) => a.kind === 'review')).toHaveLength(20);
    });

    it('awards reviewer-50 from total reviews', () => {
      let state = reduceLocalState(fresh(), { type: 'saveWord', word: 'zeta', definition: 'd' }, T0).state;
      const badges: string[] = [];
      for (let i = 0; i < 50; i++) {
        const r = reduceLocalState(state, { type: 'reviewWord', word: 'zeta', grade: 'hard' }, T0 + i + 1);
        badges.push(...r.events.newBadges);
        state = r.state;
      }
      expect(badges).toEqual(['reviewer-50']);
    });
  });

  describe('journal', () => {
    it('saveEntry creates, updates and awards +15 once when reaching minWords', () => {
      const short = reduceLocalState(fresh(), { type: 'saveEntry', entry: { id: 'e1', promptKind: 'summary', prompt: 'Sum up', body: words(10) }, minWords: 40 }, T0);
      expect(short.events.xpGained).toBe(0);
      expect(short.events.newBadges).toEqual(['first-entry']);
      expect(short.state.journal.e1).toMatchObject({ wordCount: 10, createdAt: T0, updatedAt: T0 });
      expect(short.state.activity).toHaveLength(1);

      const long = reduceLocalState(short.state, { type: 'saveEntry', entry: { id: 'e1', promptKind: 'summary', prompt: 'Sum up', body: words(45) }, minWords: 40 }, T0 + 5_000);
      expect(long.events.xpGained).toBe(15);
      expect(long.state.journal.e1).toMatchObject({ wordCount: 45, createdAt: T0, updatedAt: T0 + 5_000 });

      const longer = reduceLocalState(long.state, { type: 'saveEntry', entry: { id: 'e1', promptKind: 'summary', prompt: 'Sum up', body: words(80) }, minWords: 40 }, T0 + 9_000);
      expect(longer.events.xpGained).toBe(0);
      expect(longer.state.xp).toBe(15);
      expect(longer.state.activity).toHaveLength(2);
    });

    it('autosaving identical content changes nothing', () => {
      const action: LocalAction = { type: 'saveEntry', entry: { id: 'e1', promptKind: 'free', prompt: '', body: 'Hello there' } };
      const first = reduceLocalState(fresh(), action, T0);
      expect(reduceLocalState(first.state, action, T0 + 1_000).state).toBe(first.state);
    });

    it('keeps, replaces or clears feedback', () => {
      const base: LocalAction = { type: 'saveEntry', entry: { id: 'e1', promptKind: 'free', prompt: '', body: 'One two three', feedback } };
      const withFeedback = reduceLocalState(fresh(), base, T0).state;
      expect(withFeedback.journal.e1.feedback).toEqual(feedback);
      const kept = reduceLocalState(withFeedback, { type: 'saveEntry', entry: { id: 'e1', promptKind: 'free', prompt: '', body: 'One two three four' } }, T0 + 1).state;
      expect(kept.journal.e1.feedback).toEqual(feedback);
      const cleared = reduceLocalState(kept, { type: 'saveEntry', entry: { id: 'e1', promptKind: 'free', prompt: '', body: 'One two three four', feedback: null } }, T0 + 2).state;
      expect(cleared.journal.e1.feedback).toBeUndefined();
    });

    it('writing counts as a reading day and deleteEntry keeps earned XP', () => {
      const saved = reduceLocalState(fresh(), { type: 'saveEntry', entry: { id: 'e1', promptKind: 'free', prompt: '', body: words(60) } }, T0).state;
      expect(saved.longestStreak).toBe(1);
      const deleted = reduceLocalState(saved, { type: 'deleteEntry', id: 'e1' }, T0 + 1).state;
      expect(deleted.journal).toEqual({});
      expect(deleted.xp).toBe(15);
      expect(reduceLocalState(deleted, { type: 'deleteEntry', id: 'e1' }, T0 + 2).state).toBe(deleted);
    });

    it('awards writer-5 after five written entries', () => {
      const steps: Array<[LocalAction, number]> = Array.from({ length: 5 }, (_, i) => [
        { type: 'saveEntry', entry: { id: `e${i}`, promptKind: 'free', prompt: '', body: 'Some words here' } },
        T0 + i,
      ]);
      const { events } = run(fresh(), steps);
      expect(events[4].newBadges).toEqual(['writer-5']);
    });

    it('clips over-long bodies to the storage limit', () => {
      const body = 'a '.repeat(LIMITS.bodyChars);
      const result = reduceLocalState(fresh(), { type: 'saveEntry', entry: { id: 'e1', promptKind: 'free', prompt: '', body } }, T0);
      expect(result.state.journal.e1.body.length).toBe(LIMITS.bodyChars);
    });
  });

  describe('streaks and levels', () => {
    it('tracks the longest streak and awards streak stamps', () => {
      const steps: Array<[LocalAction, number]> = Array.from({ length: 7 }, (_, i) => [
        { type: 'completeRead', ...story(`s${i}`) },
        T0 + i * DAY,
      ]);
      const { state, events } = run(fresh(), steps);
      expect(state.longestStreak).toBe(7);
      expect(events[2].newBadges).toContain('streak-3');
      expect(events[6].newBadges).toContain('streak-7');
      // A gap keeps the record.
      const later = reduceLocalState(state, { type: 'completeRead', ...story('late') }, T0 + 20 * DAY);
      expect(later.state.longestStreak).toBe(7);
    });

    it('reports a level-up when XP crosses a threshold', () => {
      let state = fresh();
      let levelUps = 0;
      for (let i = 0; i < 3; i++) {
        const r = reduceLocalState(state, { type: 'submitQuiz', ...story(`q${i}`), score: 5, total: 5, answers: [] }, T0 + i);
        if (r.events.levelUp) {
          levelUps += 1;
          expect(r.events.levelUp.id).toBe('reader');
        }
        state = r.state;
      }
      expect(state.xp).toBe(120);
      expect(levelUps).toBe(1);
    });

    it('prunes activity older than the retention window', () => {
      const old = reduceLocalState(fresh(), { type: 'completeRead', ...story('old') }, T0).state;
      const later = reduceLocalState(old, { type: 'completeRead', ...story('new') }, T0 + (LIMITS.activityDays + 2) * DAY).state;
      expect(later.activity.map((a) => a.ref)).toEqual(['new']);
      expect(later.xp).toBe(20);
    });
  });

  describe('prefs, import and clear', () => {
    it('setPrefs merges valid fields and ignores invalid ones', () => {
      const state = fresh();
      const next = reduceLocalState(state, { type: 'setPrefs', prefs: { textSize: 'xl', aiFeedback: false, timezone: 'Not/AZone' } }, T0).state;
      expect(next.prefs).toMatchObject({ textSize: 'xl', aiFeedback: false, timezone: ZONE });
      expect(reduceLocalState(next, { type: 'setPrefs', prefs: { textSize: 'xl' } }, T0).state).toBe(next);
      const zone = reduceLocalState(next, { type: 'setPrefs', prefs: { timezone: 'Asia/Tokyo' } }, T0).state;
      expect(zone.prefs.timezone).toBe('Asia/Tokyo');
    });

    it('importBackup replaces or merges without a celebration', () => {
      const mine = reduceLocalState(fresh(), { type: 'completeRead', ...story('mine') }, T0).state;
      const theirs = run(fresh(), [
        [{ type: 'completeRead', ...story('theirs', 'games') }, T0 - 2 * HOUR],
        [{ type: 'saveWord', word: 'eta', definition: 'd' }, T0 - HOUR],
      ]).state;
      const replaced = reduceLocalState(mine, { type: 'importBackup', state: theirs, mode: 'replace' }, T0 + 1);
      expect(Object.keys(replaced.state.reads)).toEqual(['theirs']);
      expect(replaced.events.levelUp).toBeNull();
      const merged = reduceLocalState(mine, { type: 'importBackup', state: theirs, mode: 'merge' }, T0 + 1);
      expect(Object.keys(merged.state.reads).sort()).toEqual(['mine', 'theirs']);
      expect(merged.state.xp).toBe(22);
      expect(merged.events.xpGained).toBe(0);
    });

    it('clearAll resets everything but keeps the device time zone', () => {
      const busy = reduceLocalState(fresh(), { type: 'completeRead', ...story('s1') }, T0).state;
      const cleared = reduceLocalState(busy, { type: 'clearAll' }, T0 + 1);
      expect(cleared.state).toEqual(createInitialState(T0 + 1, ZONE));
      expect(cleared.events.newBadges).toEqual([]);
    });
  });

  it('never mutates the input state', () => {
    const state = fresh();
    const snapshot = JSON.stringify(state);
    run(state, [
      [{ type: 'completeRead', ...story('s1') }, T0],
      [{ type: 'saveWord', word: 'theta', definition: 'd' }, T0],
    ]);
    reduceLocalState(state, { type: 'saveWord', word: 'iota', definition: 'd' }, T0);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('LocalActionSchema', () => {
  it('accepts valid actions and rejects hostile or malformed ones', () => {
    expect(LocalActionSchema.safeParse({ type: 'saveWord', word: 'kappa', definition: 'd' }).success).toBe(true);
    expect(LocalActionSchema.safeParse({ type: 'saveWord', word: 'two words', definition: 'd' }).success).toBe(false);
    expect(LocalActionSchema.safeParse({ type: 'startRead', ...story('__proto__') }).success).toBe(false);
    expect(LocalActionSchema.safeParse({ type: 'submitQuiz', ...story('s'), score: 9, total: 5, answers: [] }).success).toBe(false);
    expect(LocalActionSchema.safeParse({ type: 'nope' }).success).toBe(false);
    expect(LocalActionSchema.safeParse({ type: 'setPrefs', prefs: { textSize: 'huge' } }).success).toBe(false);
  });
});
