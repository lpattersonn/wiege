import Link from 'next/link';
import type { ReactNode } from 'react';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { buttonClasses } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { MetaCategory, MetaMinutes, MetaRow } from '@/components/ui/MetaRow';
import type { CategorySlug } from '@/lib/categories';

import { StoryArt } from './StoryArt';

/**
 * Story cards (DESIGN §11.6). The whole card is one link (the title link's
 * ::after covers the card); focus shows the ring on the card; hover lifts
 * 3px over 150ms with the border to --ink. The `status` slot takes the
 * on-device "Read" marker island (<ReadMarker slug=… />), which reserves
 * its space so nothing shifts when it appears.
 *
 * - S (row): 64px glyph thumb, title Bodoni 700 20/24 (≤ 3 lines), meta line.
 * - M (grid): 16:9 cover, meta row, title (h4), 2-line summary.
 * - L (pick): 1.5px --ink border, inverted 16:8 cover, why line, title, meta,
 *   one secondary button (the card's link).
 */
interface BaseCardProps {
  href: string;
  title: string;
  category: CategorySlug;
  headingLevel?: 'h2' | 'h3' | 'h4';
  /** On-device status island (e.g. <ReadMarker slug={slug} />). */
  status?: ReactNode;
  className?: string;
}

const lift = 'transition-[transform,border-color] duration-150 ease-out hover:-translate-y-[3px]';
const cardFocus = 'has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-[6px] has-[a:focus-visible]:outline-ink';
const coverLink = "no-underline after:absolute after:inset-0 after:z-1 after:content-[''] focus-visible:outline-none";

export interface StoryCardSProps extends BaseCardProps {
  /** Meta text, e.g. "Question 3 of 5 next". */
  meta?: ReactNode;
  /** Optional progress line or other trailing meta (e.g. <ProgressLine value={0.6} width={120} height={10} />). */
  progress?: ReactNode;
  /** Inverted thumbnail (the first row). */
  inkThumb?: boolean;
}

export function StoryCardS({ href, title, category, headingLevel: H = 'h3', meta, progress, status, inkThumb = false, className }: StoryCardSProps) {
  return (
    <article
      className={cx(
        'relative grid min-h-[88px] grid-cols-[64px_minmax(0,1fr)] items-center gap-4 rounded-paper border border-line-soft bg-paper p-4 hover:border-ink',
        'transition-[border-color] duration-160',
        cardFocus,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx('grid size-16 place-items-center rounded-paper border', inkThumb ? 'inv border-ink' : 'border-line-soft')}
      >
        <CategoryGlyph glyph={category} size={34} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <H className="line-clamp-3 font-title text-[20px] leading-[1.2] font-bold text-ink">
          <Link href={href} className={coverLink}>
            {title}
          </Link>
        </H>
        {meta || progress || status ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption font-semibold text-ink-2">
            {meta ? <span>{meta}</span> : null}
            {progress}
            {status}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export interface StoryCardMProps extends BaseCardProps {
  slug: string;
  /** Cover key word. */
  word?: string | null;
  summary?: string;
  minutes?: number;
  inverted?: boolean;
  /** `my pick` aside on the recommended card only. */
  pick?: boolean;
  /** Extra meta item (e.g. <Tag>Practice story</Tag>). */
  tag?: ReactNode;
}

export function StoryCardM({ href, slug, title, category, word, summary, minutes, inverted, pick, tag, headingLevel: H = 'h3', status, className }: StoryCardMProps) {
  return (
    <article className={cx('group relative flex flex-col gap-4 rounded-paper pb-2', lift, cardFocus, className)}>
      <StoryArt slug={slug} category={category} word={word} inverted={inverted} pick={pick} className="transition-[border-color] duration-150 group-hover:border-ink" />
      {/* min-h-7 = the Tag's 28px, so titles line up across a grid whether or not a card carries a tag. */}
      <MetaRow className="min-h-7">
        {tag}
        <MetaCategory slug={category} />
        {minutes ? <MetaMinutes minutes={minutes} short /> : null}
        {status}
      </MetaRow>
      <H className="font-title text-[22px] leading-[1.18] font-bold text-balance text-ink lg:text-[24px]">
        <Link href={href} className={cx(coverLink, 'decoration-2 underline-offset-[5px] group-hover:underline')}>
          {title}
        </Link>
      </H>
      {summary ? <p className="line-clamp-2 font-read text-ui leading-[26px] text-ink-2">{summary}</p> : null}
    </article>
  );
}

export interface StoryCardLProps extends BaseCardProps {
  slug: string;
  word?: string | null;
  /** Why it was picked: "Picked from Writing, the corner you’ve read least this week." */
  why?: ReactNode;
  minutes?: number;
  /** "4 new words" */
  newWords?: number;
  /** Button label ("Read this story"; "Read today’s story" on first visit). */
  cta?: string;
  /** Filled button (first visit, when it is the page's one primary action). */
  primary?: boolean;
  pick?: boolean;
}

export function StoryCardL({ href, slug, title, category, word, why, minutes, newWords, cta = 'Read this story', primary = false, pick = false, headingLevel: H = 'h3', status, className }: StoryCardLProps) {
  return (
    <article className={cx('relative overflow-hidden rounded-paper border-[1.5px] border-ink bg-paper', className)}>
      <StoryArt slug={slug} category={category} word={word} inverted ratio="16/8" bare pick={pick} />
      <div className="grid gap-3 p-5 md:p-6">
        {why ? <p className="text-small leading-snug text-ink-2">{why}</p> : null}
        <H className="font-title text-[22px] leading-[1.18] font-bold text-balance text-ink lg:text-[24px]">{title}</H>
        {minutes || newWords || status ? (
          <MetaRow>
            {minutes ? <MetaMinutes minutes={minutes} /> : null}
            {newWords ? (
              <span>
                <span className="num">{newWords}</span> new word{newWords === 1 ? '' : 's'}
              </span>
            ) : null}
            {status}
          </MetaRow>
        ) : null}
        <Link href={href} className={cx(buttonClasses({ variant: primary ? 'primary' : 'secondary' }), 'static! justify-self-start', "after:absolute after:inset-0 after:content-['']")}>
          {cta}
        </Link>
      </div>
    </article>
  );
}

/** Card grid: 3 / 2 / 1 columns at ≥1024 / ≥768 / less; 24px gap (16 mobile). */
export function StoryGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3', className)}>{children}</div>;
}
