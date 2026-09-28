import type { ReactNode } from 'react';

import { Seal } from '@/components/pen/marks';
import type { BadgeId } from '@/lib/progress/badges';

import { cx } from './cx';

/**
 * Stamp (badge) tile (DESIGN §11.15): a 96px pen seal plus a caption —
 * name (15 700) and how it was earned (14 --ink-3, max 18ch). Locked stamps
 * read "Next: …". The seal is role="img" with "Stamp earned: …" /
 * "Stamp not earned yet: …".
 */

/** Stamp faces (DESIGN §11.15 table). */
export const STAMP_FACES: Record<BadgeId, string> = {
  'first-story': '1',
  'first-word': 'W',
  'words-10': '10',
  'words-50': '50',
  'first-entry': 'quill',
  'perfect-quiz': '5/5',
  'streak-3': '3',
  'streak-7': '7',
  'streak-30': '30',
  'all-four': '4',
  'writer-5': '5',
  'reviewer-50': '50',
};

export interface StampTileProps {
  /** Stamp id (sets the face and seeds the rings). */
  id: BadgeId;
  name: string;
  /** How it was earned (earned) or the hint (locked, shown as "Next: …"). */
  how: ReactNode;
  earned: boolean;
  /** Play the 240ms thunk: only right after it is earned. */
  animate?: boolean;
  className?: string;
}

export function StampTile({ id, name, how, earned, animate = false, className }: StampTileProps) {
  return (
    <li className={cx('grid content-start justify-items-start gap-2', className)}>
      <Seal
        face={STAMP_FACES[id]}
        earned={earned}
        seed={id}
        animate={animate}
        label={earned ? `Stamp earned: ${name}` : `Stamp not earned yet: ${name}`}
      />
      <span className="text-small leading-[1.3] font-bold text-ink">{name}</span>
      <span className="max-w-[18ch] text-caption leading-[1.35] text-ink-3">
        {earned ? how : <>Next: {typeof how === 'string' ? how.charAt(0).toLowerCase() + how.slice(1) : how}</>}
      </span>
    </li>
  );
}

/** Stamps wall: 4 columns from 768px, 2 on mobile. Children are <StampTile>s. */
export function StampGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx('grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4', className)}>{children}</ul>;
}
