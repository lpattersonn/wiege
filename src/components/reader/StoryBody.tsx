import { cx } from '@/components/ui/cx';
import { GRADE_BANDS, type GradeBand } from '@/lib/literacy/types';

import { OVERLAY_ID, STORY_BODY_ID } from './ids';
import { ReaderWord } from './ReaderWord';
import type { Segment } from './segment';

/**
 * The retelling, server-rendered at both levels (SPEC §8, DESIGN §12.4). The
 * <article> from <ReaderRoot> carries `data-level`, and CSS shows one level:
 * no client render decides what text you see, so there is no flash or shift
 * when the stored grade band is 9–10. Paragraphs are plain text with lesson
 * words as <ReaderWord> islands; any other word is looked up by tap (no
 * per-word spans). The overlay above the text holds marks the student makes.
 */

/** Visible only at its level (the article's `data-level`). */
export function levelOnly(band: GradeBand): string {
  return band === '7-8' ? 'group-data-[level=9-10]/reader:hidden' : 'group-data-[level=7-8]/reader:hidden';
}

export function StoryBody({ slug, levels }: { slug: string; levels: Record<GradeBand, Segment[][]> }) {
  return (
    <div id={STORY_BODY_ID} className="relative mt-8">
      {GRADE_BANDS.map((band) => (
        <div key={band} data-level-body={band} className={cx('type-read [&>p+p]:mt-[1.1em]', levelOnly(band))}>
          {levels[band].map((segments, i) => (
            <p key={i} data-para={i}>
              {segments.map((segment, j) =>
                segment.kind === 'text' ? (
                  segment.text
                ) : (
                  <ReaderWord key={j} word={segment.key} text={segment.text} leading={segment.leading} trailing={segment.trailing} scope={slug} />
                ),
              )}
            </p>
          ))}
        </div>
      ))}
      <div id={OVERLAY_ID} aria-hidden="true" className="pointer-events-none absolute inset-0" />
    </div>
  );
}
