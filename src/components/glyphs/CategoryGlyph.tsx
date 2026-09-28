import type { CSSProperties, ReactNode } from 'react';

import type { CategoryGlyph as GlyphKey, CategorySlug } from '@/lib/categories';

/**
 * The four hand-drawn category glyphs (DESIGN §9), exact geometry, 48×48.
 * The only illustrated icons in the system. Stroke width follows size:
 * 2.4 at 72px, 2.2 at 56px, 1.8 at 26–34px, 1.7 at 22–30px (the default
 * picks one from `size`). aria-hidden unless a `title` is passed.
 */
const GLYPHS: Record<GlyphKey, ReactNode> = {
  quill: (
    <>
      <path d="M41.6 5.2C30.4 7.6 20.2 15.6 14.4 27.6c-1.6 3.4-2.6 6.6-3 9.4 3-1.2 6.4-2.8 9.6-5.2 9.4-7 16.2-16.2 20.6-26.6Z" />
      <path d="M8.2 42.6 30.6 16" />
      <path d="M16.6 29.2l6.2.2M20.4 23.4l6.4-.4M24.6 17.8l5.8-.8" />
      <path d="M5 44.4c3.4-.8 7.2 1 10.8-.2" />
    </>
  ),
  controller: (
    <>
      <path d="M15.2 15.4c-6.2.2-9.4 7.2-10 14-.4 5.4 3 8.2 6.8 6.2l5.4-4.6h13.4l5.6 4.8c3.8 2 7.2-.8 6.8-6.2-.6-6.8-3.8-14-10-14.2-5.4-.2-12.4-.2-18 0Z" />
      <path d="M14.6 20.8l.2 7.6M10.8 24.6l7.6.2" />
      <circle cx="31.4" cy="21.6" r="1.9" />
      <circle cx="35.8" cy="26.2" r="1.9" />
    </>
  ),
  brush: (
    <>
      <path d="M38.2 4.8c2.2-.6 5.4 2.6 4.8 4.8L28.4 24.4l-4.8-4.8Z" />
      <path d="M23.6 19.6l4.8 4.8-3 3-4.8-4.8Z" />
      <path d="M20.6 22.6l4.8 4.8c-2.2 5.4-7.6 9.4-15.2 10.8 1.2-6.8 5-12.8 10.4-15.6Z" />
      <path d="M6.4 44c6-2.6 13.4 1.6 21.6-1.4 3-1.1 5.8-1.2 8.4-.4" />
    </>
  ),
  ball: (
    <>
      <path d="M24.2 6.6c9.8-.2 17.4 7.6 17.2 17.6-.2 9.8-8 17.4-17.6 17.2C14 41.2 6.4 33.6 6.6 23.8 6.8 14 14.4 6.8 24.2 6.6Z" />
      <path d="M7.2 23.2c11.4 1.4 22.4 1.2 34 .2" />
      <path d="M24.6 7c-1.2 11.4-1 22.8-.4 34.2" />
      <path d="M12.4 11.8c5.8 6.6 6.4 18.6-.4 25.2" />
      <path d="M35.8 11.4c-6.4 6.8-6.6 18.8.4 25.8" />
    </>
  ),
};

const BY_CATEGORY: Record<CategorySlug, GlyphKey> = {
  writing: 'quill',
  games: 'controller',
  art: 'brush',
  sports: 'ball',
};

export const GLYPH_KEYS = Object.keys(GLYPHS) as GlyphKey[];

/** Stroke width for a rendered size (DESIGN §9). */
export function glyphStroke(size: number): number {
  if (size >= 64) return 2.4;
  if (size >= 48) return 2.2;
  if (size >= 26 && size <= 40) return 1.8;
  if (size > 40) return 2;
  return 1.7;
}

export interface CategoryGlyphProps {
  /** Glyph key, or a category slug (mapped to its glyph). */
  glyph: GlyphKey | CategorySlug;
  /** Rendered size in px (default 30). */
  size?: number;
  strokeWidth?: number;
  /** Accessible name; omit when the category name is visible next to it. */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export function CategoryGlyph({ glyph, size = 30, strokeWidth, title, className, style }: CategoryGlyphProps) {
  const key: GlyphKey = glyph in BY_CATEGORY ? BY_CATEGORY[glyph as CategorySlug] : (glyph as GlyphKey);
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? glyphStroke(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={className ? `glyph shrink-0 ${className}` : 'glyph shrink-0'}
      style={style}
      data-glyph={key}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {title ? <title>{title}</title> : null}
      {GLYPHS[key]}
    </svg>
  );
}
