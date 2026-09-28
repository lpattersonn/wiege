import { describe, expect, it } from 'vitest';

import { createInitialState, type LocalState } from '@/lib/local/schema';

import {
  flagAttributes,
  firstVisitFlags,
  newestCandidate,
  todayFlags,
  todayScript,
  unfinishedReads,
  type PickCandidate,
} from './today-model';

const NOW = Date.UTC(2026, 8, 27, 14, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const CANDIDATES: PickCandidate[] = [
  { slug: 'w1', category: 'writing', publishedAt: NOW - 30 * HOUR, isSample: false },
  { slug: 'g1', category: 'games', publishedAt: NOW - 2 * HOUR, isSample: false },
  { slug: 'a1', category: 'art', publishedAt: NOW - 5 * HOUR, isSample: false },
  { slug: 's1', category: 'sports', publishedAt: NOW - 1 * HOUR, isSample: false },
];

function state(patch: Partial<LocalState> = {}): LocalState {
  return { ...createInitialState(NOW - 40 * DAY, 'Europe/Berlin'), ...patch };
}

function read(category: PickCandidate['category'], startedAt: number, completedAt?: number) {
  return { title: `A ${category} story`, category, level: '7-8' as const, startedAt, ...(completedAt === undefined ? {} : { completedAt }) };
}

function word(key: string, dueAt: number) {
  return { word: key, definition: 'A meaning.', box: 1 as const, dueAt, reviews: 0, lapses: 0, createdAt: NOW - DAY };
}

describe('newestCandidate', () => {
  it('picks the newest news story', () => {
    expect(newestCandidate(CANDIDATES)).toBe(3);
  });
  it('prefers news over a newer practice story', () => {
    const cands: PickCandidate[] = [
      { slug: 'p', category: 'art', publishedAt: NOW, isSample: true },
      { slug: 'n', category: 'games', publishedAt: NOW - DAY, isSample: false },
    ];
    expect(newestCandidate(cands)).toBe(1);
  });
  it('returns -1 with no candidates', () => {
    expect(newestCandidate([])).toBe(-1);
  });
});

describe('todayFlags', () => {
  it('treats an empty or missing store as a first visit and picks the newest story', () => {
    for (const input of [null, undefined, {}, state()]) {
      expect(todayFlags(input, NOW, CANDIDATES, 3)).toEqual(firstVisitFlags(3));
    }
  });

  it('never throws on hostile or malformed input', () => {
    const inputs: unknown[] = [42, 'x', [], { reads: [] }, { reads: { a: null, b: 7, c: { startedAt: 'x' } } }, { words: { w: null } }, { reads: { __proto__: 1 } }];
    for (const input of inputs) expect(() => todayFlags(input, NOW, CANDIDATES, 0)).not.toThrow();
  });

  it('counts unfinished reads from the last 30 days, at most 3', () => {
    const reads = {
      a: read('art', NOW - HOUR),
      b: read('games', NOW - 2 * DAY),
      c: read('sports', NOW - 3 * DAY),
      d: read('writing', NOW - 4 * DAY),
      done: read('art', NOW - DAY, NOW - HOUR),
      old: read('art', NOW - 45 * DAY),
    };
    expect(todayFlags(state({ reads }), NOW, CANDIDATES, 3).cont).toBe(3);
    expect(todayFlags(state({ reads: { a: reads.a, done: reads.done, old: reads.old } }), NOW, CANDIDATES, 3).cont).toBe(1);
  });

  it('matches unfinishedReads (the list React renders)', () => {
    const reads = { a: read('art', NOW - HOUR), b: read('games', NOW - 2 * DAY), done: read('art', NOW - DAY, NOW - HOUR), old: read('art', NOW - 45 * DAY) };
    const s = state({ reads });
    const list = unfinishedReads(s, NOW);
    expect(list.map((item) => item.slug)).toEqual(['a', 'b']);
    expect(todayFlags(s, NOW, CANDIDATES, 3).cont).toBe(list.length);
  });

  it('counts words due now', () => {
    const words = { stamina: word('stamina', NOW - HOUR), gleam: word('gleam', NOW), later: word('later', NOW + DAY) };
    const flags = todayFlags(state({ words }), NOW, CANDIDATES, 3);
    expect(flags.due).toBe(2);
    expect(flags.isNew).toBe(false);
  });

  it('picks from the corner read least this week and says so', () => {
    const reads = {
      x1: read('games', NOW - DAY, NOW - DAY),
      x2: read('art', NOW - 2 * DAY, NOW - 2 * DAY),
      x3: read('sports', NOW - 3 * DAY, NOW - 3 * DAY),
    };
    const flags = todayFlags(state({ reads }), NOW, CANDIDATES, 3);
    expect(CANDIDATES[flags.pick].category).toBe('writing');
    expect(flags.why).toBe('least');
  });

  it('says "one of" when corners tie at the least', () => {
    const reads = { x1: read('games', NOW - DAY, NOW - DAY), x2: read('art', NOW - 2 * DAY, NOW - 2 * DAY) };
    const flags = todayFlags(state({ reads }), NOW, CANDIDATES, 3);
    // writing and sports both have 0 reads: the newer story (sports) wins the tie.
    expect(CANDIDATES[flags.pick].category).toBe('sports');
    expect(flags.why).toBe('tie');
  });

  it('makes no claim when nothing was read this week', () => {
    const reads = { old: read('games', NOW - 20 * DAY, NOW - 20 * DAY) };
    const flags = todayFlags(state({ reads }), NOW, CANDIDATES, 3);
    expect(flags.why).toBe('');
    expect(CANDIDATES[flags.pick].slug).toBe('s1');
  });

  it('skips stories already opened on this device, and drops the claim when the least-read corner was skipped', () => {
    const reads = {
      w1: read('writing', NOW - 40 * DAY, NOW - 39 * DAY), // today's writing story, read long ago
      x1: read('games', NOW - DAY, NOW - DAY),
      x2: read('art', NOW - 2 * DAY, NOW - 2 * DAY),
      x3: read('sports', NOW - 3 * DAY, NOW - 3 * DAY),
    };
    const flags = todayFlags(state({ reads }), NOW, CANDIDATES, 3);
    expect(CANDIDATES[flags.pick].slug).not.toBe('w1');
    expect(flags.why).toBe('');
  });

  it('still picks something when every candidate was opened', () => {
    const reads = Object.fromEntries(CANDIDATES.map((c) => [c.slug, read(c.category, NOW - DAY, NOW - DAY)]));
    const flags = todayFlags(state({ reads }), NOW, CANDIDATES, 3);
    expect(flags.pick).toBeGreaterThanOrEqual(0);
  });

  it('returns -1 when there are no candidates', () => {
    expect(todayFlags(state(), NOW, [], -1).pick).toBe(-1);
    expect(todayFlags(state({ reads: { a: read('art', NOW) } }), NOW, [], -1).pick).toBe(-1);
  });
});

describe('flagAttributes', () => {
  it('maps flags to the root data attributes', () => {
    expect(flagAttributes({ isNew: false, cont: 2, due: 1, pick: 3, why: 'least' })).toEqual({
      'data-new': '0',
      'data-cont': '2',
      'data-keep': '1',
      'data-due': '1',
      'data-one': '1',
      'data-duen': '1',
      'data-pick': '3',
      'data-why': 'least',
    });
  });
});

describe('todayScript (pre-paint)', () => {
  function run(stored: string | null, cands = CANDIDATES, fallback = newestCandidate(CANDIDATES)) {
    const attrs: Record<string, string> = {};
    const parent = { setAttribute: (k: string, v: string) => void (attrs[k] = v) };
    const document = { currentScript: { parentElement: parent } };
    const localStorage = { getItem: (key: string) => (key === 'wiege:v1' ? stored : null) };
    new Function('document', 'localStorage', todayScript(cands, fallback))(document, localStorage);
    return attrs;
  }

  it('sets the same attributes React renders, for a returning student', () => {
    const s = state({
      reads: { a: read('art', NOW - HOUR), b: read('games', NOW - DAY, NOW - DAY) },
      words: { stamina: word('stamina', 0) },
    });
    const attrs = run(JSON.stringify(s));
    expect(attrs).toEqual(flagAttributes(todayFlags(s, Date.now(), CANDIDATES, 3)));
    expect(attrs['data-new']).toBe('0');
    expect(attrs['data-cont']).toBe('1');
    expect(attrs['data-one']).toBe('1');
  });

  it('keeps the first-visit layout for an empty device', () => {
    expect(run(null)).toEqual(flagAttributes(firstVisitFlags(3)));
  });

  it('does nothing (and does not throw) on corrupt storage', () => {
    expect(run('{not json')).toEqual({});
  });

  it('cannot be broken out of by story data', () => {
    const cands: PickCandidate[] = [{ slug: '</script><script>alert(1)</script>', category: 'art', publishedAt: NOW, isSample: false }];
    const source = todayScript(cands, 0);
    expect(source).not.toContain('</script>');
    expect(run(null, cands, 0)['data-pick']).toBe('0');
  });
});
