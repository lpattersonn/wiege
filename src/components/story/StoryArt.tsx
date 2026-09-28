import type { CSSProperties } from 'react';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { bodoniEm } from '@/components/pen/metrics';
import { fnv1a } from '@/components/pen/pen';
import { PenMark, type PenKind } from '@/components/pen/PenMark';
import { cx } from '@/components/ui/cx';
import type { CategorySlug } from '@/lib/categories';

/**
 * The key-word cover (DESIGN §8.9): the story's key vocabulary word in
 * Bodoni 900, bottom-left, fitted to the cover width exactly and never
 * cropped, wearing one pen mark (fnv1a(slug) % 4), with the category glyph
 * top-left. Deterministic and server-rendered: no client JS. aria-hidden —
 * the card title carries the meaning.
 *
 * Fit: the server sums per-letter Bodoni advances into `--em`; CSS sets
 * `font-size: min((100cqw - 48px) / var(--em), 136px)` in a size container.
 */
export interface StoryArtProps {
  slug: string;
  category: CategorySlug;
  /** Key word (≤ 12 letters). Anything else falls back to the glyph at 96px. */
  word?: string | null;
  /** The one highlighted cover in a list (lead card, Today's pick). */
  inverted?: boolean;
  /** Show the `my pick` hand aside (only the recommended story). */
  pick?: boolean;
  /** 16:9 cards, 16:8 for Today's pick. */
  ratio?: '16/9' | '16/8';
  /** Drop the border and radius (inside the L pick card). */
  bare?: boolean;
  className?: string;
}

const MARKS: PenKind[] = ['underline', 'double', 'squiggle', 'loop'];
/** How far each mark hangs below the word box (globals.css .pm--*), in em of the word. */
const MARK_DROP: Partial<Record<PenKind, number>> = { underline: 0.3, double: 0.46, squiggle: 0.34 };
const WORD_PATTERN = /^[\p{L}][\p{L}'’-]{0,11}$/u;

export function coverWord(word: string | null | undefined): string | null {
  const w = word?.trim();
  return w && Array.from(w).length <= 12 && WORD_PATTERN.test(w) ? w : null;
}

export function coverMark(slug: string): PenKind {
  return MARKS[fnv1a(slug) % MARKS.length];
}

export function StoryArt({ slug, category, word, inverted = false, pick = false, ratio = '16/9', bare = false, className }: StoryArtProps) {
  const key = coverWord(word);
  const em = key ? bodoniEm(key, { weight: 900, tracking: -0.025 }) : 0;
  const mark = coverMark(slug);
  // Lift the word so its mark stays inside the cover's 22px bottom padding: at large sizes
  // an underline or squiggle hangs further than that and would be cropped (§8.9: never crop).
  const drop = MARK_DROP[mark] ?? 0;
  return (
    <div
      aria-hidden="true"
      className={cx(
        'relative flex items-end overflow-hidden pb-[22px] pl-[22px] [container-type:inline-size]',
        ratio === '16/8' ? 'aspect-[16/8]' : 'aspect-video',
        !bare && 'rounded-paper border',
        inverted ? 'inv border-ink' : 'border-line-soft bg-paper text-ink',
        className,
      )}
    >
      <CategoryGlyph glyph={category} size={30} strokeWidth={1.7} className="absolute top-[18px] left-5" />
   {pick ? <span className="absolute top-4 right-5 type-hand">my pick</span> : null}
      {key ? (
        <span
          className="relative font-display leading-[0.9] font-black tracking-[-0.025em] whitespace-nowrap"
          style={
            {
              '--em': em.toFixed(3),
              fontSize: 'min(calc((100cqw - 48px) / var(--em)), 136px)',
              marginBottom: drop ? `max(0px, calc(${drop}em - 16px))` : undefined,
            } as CSSProperties
          }
        >
          {key}
          <PenMark kind={mark} word={key} scope={slug} font="display-900" context="cover" scale={1.6} />
        </span>
      ) : (
        <CategoryGlyph glyph={category} size={96} strokeWidth={2.4} className="mb-1" />
      )}
    </div>
  );
}
