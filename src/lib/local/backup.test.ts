import { describe, expect, it } from 'vitest';

import {
  BACKUP_MAX_BYTES,
  backupFilename,
  exportBackup,
  mergeBackups,
  parseBackup,
  parseBackupText,
  serializeBackup,
} from './backup';
import { reduceLocalState, type LocalAction } from './reducers';
import {
  createInitialState,
  LocalStateSchema,
  migrateLocalState,
  safeJsonParse,
  salvageLocalState,
  type LocalState,
} from './schema';

const ZONE = 'UTC';
const T0 = Date.parse('2026-09-20T10:00:00Z');
const DAY = 86_400_000;

function build(steps: Array<[LocalAction, number]>, start = createInitialState(T0 - DAY, ZONE)): LocalState {
  return steps.reduce((state, [action, now]) => reduceLocalState(state, action, now).state, start);
}

const story = (slug: string) => ({ slug, title: slug, category: 'art', level: '7-8' }) as const;

const sample = build([
  [{ type: 'submitQuiz', ...story('s1'), score: 4, total: 5, answers: [0, 1, 2, 3, 0] }, T0],
  [{ type: 'saveWord', word: 'lucid', definition: 'clear' }, T0 + 1],
  [{ type: 'saveEntry', entry: { id: 'e1', promptKind: 'free', prompt: '', body: 'A short note' } }, T0 + 2],
]);

describe('export', () => {
  it('names the file by local date and round-trips through parse', async () => {
    expect(backupFilename(Date.parse('2026-09-27T23:30:00Z'), 'Europe/Berlin')).toBe('wiege-backup-2026-09-28.json');
    const blob = exportBackup(sample, T0 + 10);
    expect(blob.type).toBe('application/json');
    const parsed = await parseBackup(blob);
    expect(parsed).toMatchObject({ ok: true, summary: { storiesRead: 1, words: 1, journalEntries: 1, xp: sample.xp, exportedAt: T0 + 10 } });
    if (parsed.ok) expect(parsed.state).toEqual(sample);
  });

  it('accepts a bare state without the envelope', () => {
    expect(parseBackupText(JSON.stringify(sample)).ok).toBe(true);
  });
});

describe('parseBackup rejects bad files without throwing', () => {
  it.each([
    ['empty text', '', 'empty'],
    ['whitespace', '   \n', 'empty'],
    ['not JSON', '{"format": "wiege-backup", ', 'not-json'],
    ['a JSON array', '[1,2,3]', 'not-wiege'],
    ['a JSON string', '"hello"', 'not-wiege'],
    ['another app', JSON.stringify({ format: 'other-app', state: {} }), 'not-wiege'],
    ['an unrelated object', JSON.stringify({ hello: 'world' }), 'not-wiege'],
    ['a missing version', JSON.stringify({ format: 'wiege-backup', state: { prefs: {} } }), 'invalid'],
    ['a newer version', JSON.stringify({ format: 'wiege-backup', state: { ...sample, version: 99 } }), 'newer-version'],
    ['version zero', JSON.stringify({ format: 'wiege-backup', state: { ...sample, version: 0 } }), 'invalid'],
    ['a wrong field type', JSON.stringify({ format: 'wiege-backup', state: { ...sample, xp: 'lots' } }), 'invalid'],
    ['negative XP', JSON.stringify({ format: 'wiege-backup', state: { ...sample, xp: -5 } }), 'invalid'],
    ['a bad category', JSON.stringify({ ...sample, reads: { s1: { ...sample.reads.s1, category: 'politics' } } }), 'invalid'],
    ['a mismatched word key', JSON.stringify({ ...sample, words: { other: sample.words.lucid } }), 'invalid'],
    ['a bad day key', JSON.stringify({ ...sample, activity: [{ ...sample.activity[0], day: '2026-02-30' }] }), 'invalid'],
  ])('%s', (_label, text, code) => {
    const result = parseBackupText(text);
    expect(result).toMatchObject({ ok: false, code });
    if (!result.ok) expect(result.message.length).toBeGreaterThan(10);
  });

  it('rejects files over 2 MB before reading them', async () => {
    const big = new Blob(['x'.repeat(BACKUP_MAX_BYTES + 1)]);
    expect(await parseBackup(big)).toMatchObject({ ok: false, code: 'too-large' });
    expect(parseBackupText(`"${'é'.repeat(BACKUP_MAX_BYTES / 2)}"`)).toMatchObject({ ok: false, code: 'too-large' });
    expect(await parseBackup(new Blob([]))).toMatchObject({ ok: false, code: 'empty' });
  });

  it('reports unreadable files', async () => {
    const broken = { size: 10, text: () => Promise.reject(new Error('gone')) } as unknown as Blob;
    expect(await parseBackup(broken)).toMatchObject({ ok: false, code: 'unreadable' });
  });

  it('neutralises hostile __proto__ keys (no prototype pollution)', () => {
    const hostile = JSON.stringify({ format: 'wiege-backup', state: sample }).replace(
      '"words":{',
      '"words":{"__proto__":{"polluted":true,"word":"x","definition":"x","box":1,"dueAt":0,"reviews":0,"lapses":0,"createdAt":0},',
    );
    const result = parseBackupText(hostile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.state.words)).toEqual(['lucid']);
      expect(Object.getPrototypeOf(result.state.words)).toBe(Object.prototype);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    const topLevel = parseBackupText(`{"__proto__":{"isAdmin":true},"format":"wiege-backup","state":${JSON.stringify(sample)}}`);
    expect(topLevel.ok).toBe(true);
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();

    const parsed = safeJsonParse('{"a":{"__proto__":{"x":1}},"constructor":{"prototype":{"y":2}}}') as Record<string, unknown>;
    expect(Object.keys(parsed.a as object)).toEqual([]);
    expect(({} as Record<string, unknown>).y).toBeUndefined();
  });

  it('rejects oversized collections', () => {
    const activity = Array.from({ length: 6001 }, () => sample.activity[0]);
    expect(parseBackupText(JSON.stringify({ ...sample, activity }))).toMatchObject({ ok: false, code: 'invalid' });
  });
});

describe('versioning', () => {
  it('accepts the current version and refuses unknown ones', () => {
    expect(migrateLocalState(sample)).toMatchObject({ ok: true });
    expect(migrateLocalState({ ...sample, version: 2 })).toEqual({ ok: false, reason: 'newer-version' });
    expect(migrateLocalState({ ...sample, version: '1' })).toEqual({ ok: false, reason: 'unknown-version' });
    expect(migrateLocalState(null)).toEqual({ ok: false, reason: 'not-object' });
  });
});

describe('salvageLocalState (this device’s own storage)', () => {
  it('keeps valid parts and drops broken records instead of wiping progress', () => {
    const damaged = JSON.parse(JSON.stringify(sample)) as Record<string, unknown>;
    (damaged.words as Record<string, unknown>).broken = { word: 'broken' };
    (damaged.prefs as Record<string, unknown>).textSize = 'gigantic';
    damaged.activity = [...(damaged.activity as unknown[]), { day: 'yesterday' }];
    const salvaged = salvageLocalState(damaged, T0, ZONE);
    expect(salvaged).not.toBeNull();
    expect(Object.keys(salvaged!.words)).toEqual(['lucid']);
    expect(salvaged!.prefs.textSize).toBe('m');
    expect(salvaged!.activity).toHaveLength(sample.activity.length);
    expect(salvaged!.xp).toBe(sample.xp);
    expect(LocalStateSchema.safeParse(salvaged).success).toBe(true);
  });

  it('re-keys words and returns null for unusable input', () => {
    const rekey = { ...sample, words: { WRONG: sample.words.lucid } };
    expect(Object.keys(salvageLocalState(rekey, T0, ZONE)!.words)).toEqual(['lucid']);
    expect(salvageLocalState('nope', T0, ZONE)).toBeNull();
    expect(salvageLocalState({ ...sample, version: 7 }, T0, ZONE)).toBeNull();
  });
});

describe('mergeBackups', () => {
  const phone = build([
    [{ type: 'completeRead', ...story('shared') }, T0],
    [{ type: 'saveWord', word: 'vivid', definition: 'bright' }, T0 + 1],
    [{ type: 'saveEntry', entry: { id: 'j1', promptKind: 'free', prompt: '', body: 'Phone draft' } }, T0 + 2],
    [{ type: 'setPrefs', prefs: { theme: 'dark' } }, T0 + 3],
  ]);
  const laptop = build([
    [{ type: 'completeRead', ...story('shared') }, T0 - 5_000],
    [{ type: 'submitQuiz', ...story('shared'), score: 5, total: 5, answers: [0, 0, 0, 0, 0] }, T0 - 4_000],
    [{ type: 'saveWord', word: 'vivid', definition: 'bright' }, T0 - 3_000],
    [{ type: 'reviewWord', word: 'vivid', grade: 'good' }, T0 - 2_000],
    [{ type: 'saveEntry', entry: { id: 'j1', promptKind: 'free', prompt: '', body: 'Laptop final version' } }, T0 + 60_000],
    [{ type: 'completeRead', ...story('laptop-only') }, T0 + 70_000],
  ]);

  it('unions records; newest updatedAt wins for journal entries', () => {
    const merged = mergeBackups(phone, laptop);
    expect(Object.keys(merged.reads).sort()).toEqual(['laptop-only', 'shared']);
    expect(merged.reads.shared.completedAt).toBe(T0 - 5_000);
    expect(merged.reads.shared.quiz?.score).toBe(5);
    expect(merged.words.vivid.reviews).toBe(1);
    expect(merged.journal.j1.body).toBe('Laptop final version');
    expect(merged.prefs.theme).toBe('dark');
    expect(merged.createdAt).toBe(Math.min(phone.createdAt, laptop.createdAt));
    expect(LocalStateSchema.safeParse(merged).success).toBe(true);
  });

  it('recomputes XP from the merged activity, so merging twice never double-counts', () => {
    const merged = mergeBackups(phone, laptop);
    const activityXp = merged.activity.reduce((sum, a) => sum + a.xp, 0);
    expect(merged.xp).toBe(activityXp);
    expect(mergeBackups(merged, laptop).xp).toBe(merged.xp);
    expect(mergeBackups(merged, merged)).toEqual(merged);
    expect(mergeBackups(phone, phone)).toEqual(phone);
  });

  it('keeps XP whose activity was already pruned, and the earliest stamp dates', () => {
    const veteran: LocalState = { ...laptop, xp: laptop.xp + 500, longestStreak: 40 };
    const merged = mergeBackups(phone, veteran);
    const activityXp = merged.activity.reduce((sum, a) => sum + a.xp, 0);
    expect(merged.xp).toBe(activityXp + 500);
    expect(merged.longestStreak).toBe(40);
    expect(merged.badges['first-story']?.awardedAt).toBe(Math.min(phone.badges['first-story']!.awardedAt, laptop.badges['first-story']!.awardedAt));
  });

  it('serialises deterministically', () => {
    expect(JSON.parse(serializeBackup(phone, 5))).toEqual({ format: 'wiege-backup', exportedAt: 5, state: phone });
  });
});
