import type { ElementType, ReactNode } from 'react';

import { cx } from '@/components/ui/cx';

/**
 * Containers (DESIGN §5.2) with the responsive gutter (20 / 32 / 40px).
 * page 1440 · app 1280 · narrow 560 (404, error, practice) · settings 640 ·
 * form 440.
 */
const WIDTHS = {
  page: 'max-w-[1440px]',
  app: 'max-w-[1280px]',
  settings: 'max-w-[calc(640px+2*var(--gutter))]',
  narrow: 'max-w-[calc(560px+2*var(--gutter))]',
  form: 'max-w-[calc(440px+2*var(--gutter))]',
} as const;

export type ContainerSize = keyof typeof WIDTHS;

export function PageContainer({ size = 'page', as: Tag = 'div', className, children }: { size?: ContainerSize; as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={cx('mx-auto w-full px-(--gutter)', WIDTHS[size], className)}>{children}</Tag>;
}

/**
 * A page section: 112px top and bottom from 1024px, 56px on mobile; `rule`
 * adds the 1px --line-soft rule on top.
 */
export function Section({ id, rule = false, labelledBy, className, children }: { id?: string; rule?: boolean; labelledBy?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cx('py-14 lg:py-28', rule && 'border-t border-line-soft', className)}>
      {children}
    </section>
  );
}

/**
 * Section head: heading and lede stacked (never heading-left + subline-right),
 * max 760px, 12px between, 40px to the content. `inFolio` aligns it with the
 * folio's text column at ≥ 1280.
 */
export function SectionHead({ title, id, lede, level: H = 'h2', inFolio = false, className }: { title: ReactNode; id?: string; lede?: ReactNode; level?: 'h1' | 'h2'; inFolio?: boolean; className?: string }) {
  return (
    <div className={cx('mb-10 grid max-w-[760px] gap-3', inFolio && 'xl:ml-[calc(216px+48px)]', className)}>
      <H id={id} className={H === 'h1' ? 'type-h1' : 'type-h2'}>
        {title}
      </H>
      {lede ? <p className="type-lede">{lede}</p> : null}
    </div>
  );
}

/**
 * The folio (DESIGN §5.3), the signature grid: left margin | text | right margin.
 * ≥ 1280: 216 | 1fr | 312, gap 48. 1024–1279: 1fr | 288 with the left
 * margin as a row above. < 1024: one column (notes go inline or to the sheet).
 */
export function Folio({ as: Tag = 'div', className, children, id }: { as?: ElementType; className?: string; children: ReactNode; id?: string }) {
  return (
    <Tag
      id={id}
      data-folio=""
      className={cx(
        'relative grid grid-cols-[minmax(0,1fr)] gap-y-6 [grid-template-areas:"l"_"m"_"r"]',
        'lg:grid-cols-[minmax(0,1fr)_288px] lg:gap-x-12 lg:[grid-template-areas:"l_l"_"m_r"]',
        'xl:grid-cols-[216px_minmax(0,1fr)_312px] xl:[grid-template-areas:"l_m_r"]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Left margin: page pitch, step numbers, back link and meta. */
export function FolioLeft({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cx('min-w-0 [grid-area:l]', className)}>{children}</div>;
}

/** The text column. Margin notes measure against it for their leader arrows. */
export function FolioMain({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div data-folio-main="" className={cx('min-w-0 [grid-area:m]', className)}>
      {children}
    </div>
  );
}

/** Right margin (position: relative): where <MarginNote placement="margin"> lives. */
export function FolioMargin({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cx('relative min-w-0 [grid-area:r]', className)}>{children}</div>;
}
