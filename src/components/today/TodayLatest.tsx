import Link from 'next/link';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { ReadMarker } from '@/components/local/LocalCount';
import { cx } from '@/components/ui/cx';
import { CATEGORIES } from '@/lib/categories';
import type { LatestByCategory } from '@/lib/stories';

/**
 * Latest by category (DESIGN §12.2): per corner, a ruled head (glyph, name,
 * "See all") and its newest headlines, 3 from 672px of content and 1 below
 * (mobile). Headlines carry the on-device "Read" marker, whose space is
 * always reserved.
 */
export function TodayLatest({ latest }: { latest: LatestByCategory }) {
  return (
    <section aria-labelledby="latest-h">
      <h2 id="latest-h" className="sr-only">
        Latest stories
      </h2>
      <div className="grid gap-8 @2xl/app:grid-cols-2 @2xl/app:gap-x-8 @2xl/app:gap-y-10">
        {CATEGORIES.map((category) => {
          const stories = (latest[category.slug] ?? []).slice(0, 3);
          return (
            <div key={category.slug} className="min-w-0">
              <div className="flex items-center gap-3 border-b-[1.5px] border-ink pb-2">
                <CategoryGlyph glyph={category.slug} size={26} strokeWidth={1.8} className="shrink-0" />
                <h3 className="font-title text-[22px] leading-none font-bold">{category.name}</h3>
                <Link
                  href={`/c/${category.slug}`}
                  className="ml-auto inline-flex min-h-11 items-center text-caption font-bold whitespace-nowrap text-ink underline decoration-2 underline-offset-[5px] hover:decoration-[3px]"
                >
                  See all<span className="sr-only"> {category.name.toLowerCase()} stories</span>
                </Link>
              </div>
              {stories.length ? (
                <ul>
                  {stories.map((story, i) => (
                    <li key={story.slug} className={cx('border-b border-line-soft', i > 0 && 'hidden @2xl/app:block')}>
                      <Link
                        href={`/read/${encodeURIComponent(story.slug)}`}
                        className="group/row grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-3 text-ink no-underline"
                      >
                        <span className="font-read text-[17px] leading-6 decoration-2 underline-offset-4 group-hover/row:underline">
                          {story.title}
                          {story.isSample ? <span className="ml-2 font-ui text-caption font-bold whitespace-nowrap text-ink-3">Practice story</span> : null}
                        </span>
                        <ReadMarker slug={story.slug} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-small text-ink-3">No stories here yet. New ones arrive every four hours.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
