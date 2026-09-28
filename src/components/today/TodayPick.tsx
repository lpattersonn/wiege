import Link from 'next/link';

import { StoryArt } from '@/components/story/StoryArt';
import { buttonClasses } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';
import { MetaItem, MetaMinutes, MetaRow } from '@/components/ui/MetaRow';
import type { CardDetails } from '@/components/explore/card-details';
import { getCategory } from '@/lib/categories';
import type { StorySummary } from '@/lib/stories';

/**
 * Today's story (DESIGN §11.6 L card, §12.2). The server renders every
 * candidate from the today set (one per corner) stacked in one grid cell;
 * the Today root's `data-pick` flag, set before first paint, makes one of
 * them visible. The cell is always as tall as the tallest candidate, so
 * picking a different one never moves anything.
 *
 * - The "why" line appears only when it is true (`data-why`).
 * - The button is filled when it is the page's next step ("Read today's
 *   story" on a first visit), and outlined when "Keep reading" above it is.
 */
export interface PickEntry {
  story: StorySummary;
  details: CardDetails | null;
}

/** Literal classes (Tailwind needs them whole): candidate i shows when data-pick = i. */
const SHOW = [
  'group-data-[pick=0]/today:visible',
  'group-data-[pick=1]/today:visible',
  'group-data-[pick=2]/today:visible',
  'group-data-[pick=3]/today:visible',
] as const;

const coverLink = "static! justify-self-start after:absolute after:inset-0 after:content-['']";

function PickCard({ entry, className }: { entry: PickEntry; className?: string }) {
  const { story, details } = entry;
  const href = `/read/${encodeURIComponent(story.slug)}`;
  const corner = getCategory(story.category).name;
  return (
    <article
      className={cx(
        'relative overflow-hidden rounded-paper border-[1.5px] border-ink bg-paper',
        'has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-[6px] has-[a:focus-visible]:outline-ink',
        className,
      )}
    >
      <StoryArt slug={story.slug} category={story.category} word={details?.word ?? null} inverted ratio="16/8" bare />
      {/* The `my pick` aside (DESIGN §3.4, §8.9). Anchored by its left edge and rotated about it, so the
          hand font arriving late (it is not preloaded) changes only its width, never where it starts. */}
   <span aria-hidden="true"className="absolute top-4 left-[calc(100%-100px)] origin-top-left type-hand text-paper">
        my pick
      </span>
      <div className="grid gap-3 p-5 @3xl/app:p-6">
        <p className="hidden text-small leading-snug font-normal text-ink-2 group-data-[why=least]/today:block">
          Picked from {corner}, the corner you’ve read least this week.
        </p>
        <p className="hidden text-small leading-snug font-normal text-ink-2 group-data-[why=tie]/today:block">
          Picked from {corner}, one of the corners you’ve read least this week.
        </p>
        <h3 className="line-clamp-3 font-title text-[22px] leading-[1.18] font-bold text-balance text-ink lg:text-[24px]">{story.title}</h3>
        <MetaRow>
          {story.isSample ? <Tag>Practice story</Tag> : null}
          {details?.minutes ? <MetaMinutes minutes={details.minutes} /> : null}
          {details?.newWords ? (
            <MetaItem>
              <span>
                <span className="num">{details.newWords}</span> new word{details.newWords === 1 ? '' : 's'}
              </span>
            </MetaItem>
          ) : null}
        </MetaRow>
        <span className="contents group-data-[keep=1]/today:hidden">
          <Link href={href} className={cx(buttonClasses({ variant: 'primary' }), coverLink)}>
            <span className="group-data-[new=0]/today:hidden">Read today’s story</span>
            <span className="hidden group-data-[new=0]/today:inline">Read this story</span>
          </Link>
        </span>
        <span className="hidden group-data-[keep=1]/today:contents">
          <Link href={href} className={cx(buttonClasses({ variant: 'secondary' }), coverLink)}>
            Read this story
          </Link>
        </span>
      </div>
    </article>
  );
}

export function TodayPick({ entries }: { entries: PickEntry[] }) {
  return (
    <section aria-labelledby="pick-h">
      <h2 id="pick-h" className="mb-4 type-h3">
        Today’s story
      </h2>
      {entries.length ? (
        <div className="grid">
          {entries.slice(0, SHOW.length).map((entry, i) => (
            <PickCard key={entry.story.slug} entry={entry} className={cx('invisible self-start [grid-area:1/1]', SHOW[i])} />
          ))}
        </div>
      ) : (
        <div className="rounded-paper border border-dashed border-ink-3 p-6">
          <p className="font-title text-[22px] leading-[1.18] font-bold text-ink">Stories are on their way.</p>
          <p className="mt-2 text-ui text-ink-2">New ones arrive every four hours. Check back soon.</p>
        </div>
      )}
    </section>
  );
}
