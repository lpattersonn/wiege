import Link from 'next/link';
import { Children, type ReactNode } from 'react';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { cx } from '@/components/ui/cx';
import { getCategory, type CategorySlug } from '@/lib/categories';

/**
 * Category tile (DESIGN §11.7). One link. Glyph (72 desktop / 56 mobile,
 * left of the text below 1280), name Bodoni 800 38/28, description 16
 * --ink-2, "9 new today" (numeral Atkinson 800 20) or "Nothing new yet
 * today", then a rule and "Latest" with the newest headline(s). Hover lifts
 * 3px and the border goes to --ink; the glyph never animates.
 */
export interface CategoryTileProps {
  category: CategorySlug;
  /** Stories published today; 0 reads "Nothing new yet today". */
  newToday: number;
  /** Newest headline(s): 1 on the landing page, up to 3 on /c. */
  latest?: string[];
  href?: string;
  /** /c variant: min height 380, three headlines. */
  large?: boolean;
  headingLevel?: 'h2' | 'h3' | 'h4';
  className?: string;
}

export function CategoryTile({ category, newToday, latest = [], href, large = false, headingLevel: H = 'h3', className }: CategoryTileProps) {
  const { name, description } = getCategory(category);
  const headlines = latest.slice(0, large ? 3 : 1);
  return (
    <Link
      href={href ?? `/c/${category}`}
      className={cx(
        'group relative grid h-full grid-cols-[56px_minmax(0,1fr)] items-start gap-x-4 rounded-paper border border-line-soft bg-paper p-5 text-ink no-underline',
        'transition-[transform,border-color] duration-150 ease-out hover:-translate-y-[3px] hover:border-ink',
        'xl:grid-cols-1 xl:content-start xl:px-6 xl:pt-7 xl:pb-6',
        large ? 'xl:min-h-[380px]' : 'xl:min-h-[340px]',
        className,
      )}
    >
      <span className="block size-14 xl:mb-6 xl:size-[72px]" aria-hidden="true">
        <CategoryGlyph glyph={category} size={56} strokeWidth={2.2} className="xl:hidden" />
        <CategoryGlyph glyph={category} size={72} strokeWidth={2.4} className="hidden xl:block" />
      </span>
      <span className="grid min-w-0 content-start">
        <H className="font-display text-[28px] leading-none font-bold tracking-[-0.01em] xl:text-[38px]">{name}</H>
        <span className="mt-2 max-w-[30ch] text-nav leading-[1.45] text-ink-2">{description}</span>
        <span className="mt-4 inline-flex items-center gap-2 text-small font-bold">
          {newToday > 0 ? (
            <>
              <span className="num text-[20px] leading-none font-extrabold">{newToday}</span> new today
            </>
          ) : (
            'Nothing new yet today'
          )}
        </span>
        {headlines.length ? (
          <span className="mt-4 block border-t border-line-soft pt-3">
            <span className="mb-0.5 block text-caption font-bold text-ink-3">Latest</span>
            {headlines.map((headline, i) => (
              <span key={i} className={cx('block font-read text-nav leading-[23px]', i > 0 && 'mt-2')}>
                {headline}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** Category grid (a list): 1 column, 2 from 768px, 4 from 1280px; 24px gap (16 mobile). Wraps each child in <li>. */
export function CategoryGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cx('grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4', className)}>
      {Children.map(children, (child) => (child ? <li>{child}</li> : null))}
    </ul>
  );
}
