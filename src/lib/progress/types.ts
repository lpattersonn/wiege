import type { DayKey } from '@/lib/time';

/** Isomorphic progress types shared by the pure rules in lib/progress and the local store. */

export const ACTIVITY_KINDS = ['read', 'quiz', 'word', 'review', 'journal'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityEntry {
  /** Local calendar day in the student's time zone. */
  day: DayKey;
  kind: ActivityKind;
  xp: number;
  /** Story slug, word key or journal entry id the activity refers to. */
  ref?: string;
  /** Epoch milliseconds. */
  at: number;
}
