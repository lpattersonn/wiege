/** Levels (SPEC §7). Pure and isomorphic. */

export const LEVELS = [
  { id: 'scribbler', name: 'Scribbler', minXp: 0 },
  { id: 'reader', name: 'Reader', minXp: 100 },
  { id: 'storyteller', name: 'Storyteller', minXp: 300 },
  { id: 'wordsmith', name: 'Wordsmith', minXp: 700 },
  { id: 'editor', name: 'Editor', minXp: 1500 },
  { id: 'author', name: 'Author', minXp: 3000 },
  { id: 'laureate', name: 'Laureate', minXp: 6000 },
] as const;

export type Level = (typeof LEVELS)[number];
export type LevelId = Level['id'];

export function levelIndexForXp(xp: number): number {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) index = i;
  }
  return index;
}

export function levelForXp(xp: number): Level {
  return LEVELS[levelIndexForXp(xp)];
}

export interface LevelProgress {
  level: Level;
  next: Level | null;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP still needed for the next level; null at the top level. */
  xpToNext: number | null;
  /** 0..1 progress towards the next level (1 at the top level). */
  progress: number;
}

export function levelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp));
  const index = levelIndexForXp(safeXp);
  const level = LEVELS[index];
  const next = index + 1 < LEVELS.length ? LEVELS[index + 1] : null;
  const xpIntoLevel = safeXp - level.minXp;
  if (!next) return { level, next: null, xpIntoLevel, xpToNext: null, progress: 1 };
  const span = next.minXp - level.minXp;
  return { level, next, xpIntoLevel, xpToNext: next.minXp - safeXp, progress: xpIntoLevel / span };
}

/** The level reached when XP goes from `before` to `after`, or null when the level did not change. */
export function levelUpBetween(before: number, after: number): Level | null {
  const from = levelIndexForXp(before);
  const to = levelIndexForXp(after);
  return to > from ? LEVELS[to] : null;
}
