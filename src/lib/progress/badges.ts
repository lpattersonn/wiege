/** Stamps (badges), SPEC §7. Pure and isomorphic. */

export const BADGE_IDS = [
  'first-story',
  'first-word',
  'words-10',
  'words-50',
  'first-entry',
  'perfect-quiz',
  'streak-3',
  'streak-7',
  'streak-30',
  'all-four',
  'writer-5',
  'reviewer-50',
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  /** How to earn it, shown on locked stamps. */
  hint: string;
}

export const BADGES: readonly BadgeDefinition[] = [
  { id: 'first-story', name: 'First story', hint: 'Finish your first story.' },
  { id: 'first-word', name: 'First word', hint: 'Save a word to your collection.' },
  { id: 'words-10', name: 'Ten words', hint: 'Collect 10 words.' },
  { id: 'words-50', name: 'Fifty words', hint: 'Collect 50 words.' },
  { id: 'first-entry', name: 'First entry', hint: 'Write your first journal entry.' },
  { id: 'perfect-quiz', name: 'Perfect quiz', hint: 'Get every question right in a story quiz.' },
  { id: 'streak-3', name: 'Three days', hint: 'Read on 3 days in a row.' },
  { id: 'streak-7', name: 'One week', hint: 'Read on 7 days in a row.' },
  { id: 'streak-30', name: 'One month', hint: 'Read on 30 days in a row.' },
  { id: 'all-four', name: 'All four', hint: 'Finish a story from every category.' },
  { id: 'writer-5', name: 'Writer', hint: 'Write 5 journal entries.' },
  { id: 'reviewer-50', name: 'Reviewer', hint: 'Practise 50 flashcards.' },
];

const BADGE_ID_SET: ReadonlySet<string> = new Set(BADGE_IDS);

export function isBadgeId(value: unknown): value is BadgeId {
  return typeof value === 'string' && BADGE_ID_SET.has(value);
}

/** Everything a stamp rule needs, computed from the local state by the caller. */
export interface BadgeProgress {
  storiesCompleted: number;
  /** Distinct categories with at least one finished story. */
  categoriesCompleted: number;
  wordsSaved: number;
  journalEntries: number;
  hasPerfectQuiz: boolean;
  /** Best of the current and longest streak. */
  bestStreak: number;
  reviews: number;
}

const RULES: Record<BadgeId, (p: BadgeProgress) => boolean> = {
  'first-story': (p) => p.storiesCompleted >= 1,
  'first-word': (p) => p.wordsSaved >= 1,
  'words-10': (p) => p.wordsSaved >= 10,
  'words-50': (p) => p.wordsSaved >= 50,
  'first-entry': (p) => p.journalEntries >= 1,
  'perfect-quiz': (p) => p.hasPerfectQuiz,
  'streak-3': (p) => p.bestStreak >= 3,
  'streak-7': (p) => p.bestStreak >= 7,
  'streak-30': (p) => p.bestStreak >= 30,
  'all-four': (p) => p.categoriesCompleted >= 4,
  'writer-5': (p) => p.journalEntries >= 5,
  'reviewer-50': (p) => p.reviews >= 50,
};

/** Every stamp whose rule is currently met, in display order. */
export function earnedBadges(progress: BadgeProgress): BadgeId[] {
  return BADGE_IDS.filter((id) => RULES[id](progress));
}

/** Stamps met now that have not been awarded yet (stamps are never taken away). */
export function newlyEarnedBadges(progress: BadgeProgress, awarded: Readonly<Partial<Record<BadgeId, unknown>>>): BadgeId[] {
  return earnedBadges(progress).filter((id) => !Object.prototype.hasOwnProperty.call(awarded, id));
}
