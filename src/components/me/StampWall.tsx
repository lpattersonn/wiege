'use client';

import { useLocalState } from '@/components/local/hooks';
import { Seal } from '@/components/pen/marks';
import { cx } from '@/components/ui/cx';
import { StampGrid, STAMP_FACES } from '@/components/ui/StampTile';
import type { LocalState } from '@/lib/local/schema';
import { BADGES } from '@/lib/progress/badges';
import { stampWall, type StampState } from '@/lib/progress/stats';

import { EARNED_CAPTIONS, lockedCaption, orderStamps, stampsSummary } from './me-view';
import { Placeholder } from './Placeholder';

const selectBadges = (s: LocalState) => s.badges;

/** Catalogue order, all locked: only used to reserve the wall's space before hydration. */
const PLACEHOLDER_WALL: StampState[] = BADGES.map((b) => ({ ...b, unlocked: false, awardedAt: null }));

/**
 * One stamp (DESIGN §11.15): the 96px pen seal, its name, and how it was
 * earned or "Next: …". Both captions share one grid cell (the unused one is
 * invisible), so a tile is the same height whether earned or locked, and the
 * `auto-rows-fr` wall never changes height when the order changes.
 */
function StampWallTile({ stamp, ready }: { stamp: StampState; ready: boolean }) {
  const earned = ready && stamp.unlocked;
  return (
    <li className="grid content-start justify-items-start gap-2">
      {ready ? (
        <Seal
          face={STAMP_FACES[stamp.id]}
          earned={earned}
          seed={stamp.id}
          label={earned ? `Stamp earned: ${stamp.name}` : `Stamp not earned yet: ${stamp.name}`}
        />
      ) : (
        <span aria-hidden="true" className="skeleton block size-24 rounded-pill!" />
      )}
      <span className={cx('text-small leading-[1.3] font-bold text-ink', !ready && 'invisible')}>{stamp.name}</span>
      <span className="grid max-w-[18ch] text-caption leading-[1.35] text-ink-3">
        <span className={cx('[grid-area:1/1]', !earned && 'invisible')}>{EARNED_CAPTIONS[stamp.id]}</span>
        <span className={cx('[grid-area:1/1]', (earned || !ready) && 'invisible')}>{lockedCaption(stamp.hint)}</span>
      </span>
    </li>
  );
}

/** The stamps wall on /me: earned first, then locked outlines with how to earn them. */
export function StampWall({ headingId }: { headingId: string }) {
  const badges = useLocalState(selectBadges);
  const wall = badges ? orderStamps(stampWall(badges)) : null;
  return (
    <div aria-busy={wall === null || undefined}>
      <h2 id={headingId} className="type-h3">
        Stamps
      </h2>
      <p className="mt-3 type-lede">{wall ? stampsSummary(wall) : <Placeholder sizer="4 of 12 earned." />}</p>
      <StampGrid className="mt-8 auto-rows-fr gap-y-8">
        {(wall ?? PLACEHOLDER_WALL).map((stamp) => (
          <StampWallTile key={stamp.id} stamp={stamp} ready={wall !== null} />
        ))}
      </StampGrid>
    </div>
  );
}
