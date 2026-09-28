'use client';

import { StoryCardS } from '@/components/story/StoryCard';
import { LinkButton } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import type { LocalState } from '@/lib/local/schema';
import { useLocal } from '@/lib/local/store';
import { timeAgo } from '@/lib/time';

import { unfinishedReads, type ContinueItem } from './today-model';

/**
 * Continue reading (DESIGN §12.2, §14 "resume where you left off"): the 1–3
 * stories started on this device and not finished yet, most recent first,
 * then the page's one filled action, "Keep reading".
 *
 * Every row is exactly one size (title clamped to three lines on narrow
 * screens and two from 576px of content, inside a matching minimum height), and the Today root's `data-cont` flag, set before first
 * paint, decides how many rows show. So the server placeholders and the real
 * rows occupy the same space and nothing below them moves.
 */
interface Row extends ContinueItem {
  /** "2 hours ago", "yesterday" */
  started: string;
}

const select = (state: LocalState): Row[] => {
  const now = Date.now();
  return unfinishedReads(state, now).map((item) => ({ ...item, started: timeAgo(item.startedAt, now) }));
};
const sameList = (a: Row[], b: Row[]) =>
  a.length === b.length &&
  a.every((item, i) => item.slug === b[i].slug && item.title === b[i].title && item.started === b[i].started && item.category === b[i].category);

/** Row i shows when data-cont > i (the first row whenever the section shows). */
const ROW_VISIBILITY = [
  'block',
  'hidden group-data-[cont=2]/today:block group-data-[cont=3]/today:block',
  'hidden group-data-[cont=3]/today:block',
] as const;

/**
 * Title lines × 24 + 8 + the 21px meta line + 32 padding + 2 border: 3 lines
 * (135px) on narrow screens, 2 lines (111px) from 576px of content.
 */
const ROW_BOX = 'min-h-[135px]! @xl/app:min-h-[111px]!';
const TITLE_CLAMP = '[&_h3]:line-clamp-3 @xl/app:[&_h3]:line-clamp-2';

function RowPlaceholder() {
  return (
    <div aria-hidden="true" className={cx('grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 rounded-paper border border-line-soft p-4', ROW_BOX)}>
      <Skeleton width={64} height={64} />
      <span className="grid">
        <SkeletonText lines={2} lineHeight={24} />
        <span className="flex h-6 items-center @xl/app:hidden">
          <span className="skeleton block h-[14px] w-1/2" />
        </span>
        <span className="mt-2 flex h-[21px] items-center">
          <Skeleton width="40%" height={12} />
        </span>
      </span>
    </div>
  );
}

export function ContinueReading() {
  const items = useLocal(select, sameList);
  const first = items?.[0];

  return (
    <section aria-labelledby="continue-h">
      <h2 id="continue-h" className="mb-4 type-h3">
        Continue reading
      </h2>
      <ul className="grid gap-3">
        {items
          ? items.map((item, i) => (
              <li key={item.slug} className={ROW_VISIBILITY[i]}>
                <StoryCardS
                  href={`/read/${encodeURIComponent(item.slug)}`}
                  title={item.title}
                  category={item.category}
                  inkThumb={i === 0}
                  meta={<span className="whitespace-nowrap">Started {item.started}</span>}
                  className={cx(ROW_BOX, TITLE_CLAMP)}
                />
              </li>
            ))
          : ROW_VISIBILITY.map((visibility, i) => (
              <li key={i} className={visibility}>
                <RowPlaceholder />
              </li>
            ))}
      </ul>
      <div className="mt-4 flex min-h-12 items-center">
        {first ? (
          <LinkButton href={`/read/${encodeURIComponent(first.slug)}`}>
            Keep reading<span className="sr-only">: {first.title}</span>
          </LinkButton>
        ) : (
          <Skeleton round width={156} height={48} />
        )}
      </div>
    </section>
  );
}
