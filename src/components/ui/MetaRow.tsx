import type { ReactNode } from 'react';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { IconClock } from '@/components/glyphs/icons';
import { getCategory, type CategorySlug } from '@/lib/categories';

import { cx } from './cx';

/**
 * Meta row (DESIGN §11.21): icon-led items separated by an 18px gap, 15px
 * 600 --ink-2. The category item is --ink 700 with its glyph. Never joined
 * with middle dots.
 *
 *   <MetaRow><MetaCategory slug="games" /><MetaMinutes minutes={3} /><MetaItem>Grade 7–8</MetaItem></MetaRow>
 */
export function MetaRow({ children, className, as: Tag = 'p' }: { children: ReactNode; className?: string; as?: 'p' | 'div' }) {
  return <Tag className={cx('flex flex-wrap items-center gap-x-[18px] gap-y-2 text-small leading-snug font-semibold text-ink-2', className)}>{children}</Tag>;
}

export function MetaItem({ icon, children, strong = false, className }: { icon?: ReactNode; children: ReactNode; strong?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2', strong && 'font-bold text-ink', className)}>
      {icon}
      {children}
    </span>
  );
}

export function MetaCategory({ slug }: { slug: CategorySlug }) {
  return (
    <MetaItem strong icon={<CategoryGlyph glyph={slug} size={22} strokeWidth={1.7} />}>
      {getCategory(slug).name}
    </MetaItem>
  );
}

/** "3 min read" (or "3 min" with `short`). */
export function MetaMinutes({ minutes, short = false }: { minutes: number; short?: boolean }) {
  return (
    <MetaItem icon={<IconClock size={18} />}>
      <span>
        <span className="num">{minutes}</span> min{short ? '' : ' read'}
      </span>
    </MetaItem>
  );
}
