import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { AppShell } from '@/components/layout/Shells';
import { Greeting } from '@/components/local/Greeting';
import { LocalCount, ReadMarker } from '@/components/local/LocalCount';
import { MiniTally, ProgressLine } from '@/components/pen/marks';
import { StoryCardL, StoryCardS } from '@/components/story/StoryCard';
import { LinkButton } from '@/components/ui/Button';
import { FreshnessLine } from '@/components/ui/FreshnessLine';
import { CATEGORIES } from '@/lib/categories';

export const metadata: Metadata = {
  title: 'App shell preview',
  robots: { index: false, follow: false },
};

/**
 * Composition sample for app pages (the /today layout from DESIGN §12.2):
 * AppShell (app nav ≥ 768, tab bar below), container queries on `@container/app`,
 * local-store islands with reserved space. Sample content only.
 */
export default function AppShellPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <AppShell searchHref="/c">
      <div className="grid gap-4 @3xl/app:grid-cols-[minmax(0,1fr)_auto] @3xl/app:items-end @3xl/app:gap-8">
        <Greeting />
        <p className="flex flex-wrap items-center gap-x-6 gap-y-3 text-small text-ink-2">
          <span className="inline-flex items-center gap-2">
            <MiniTally count={12} />
            <span>
              <b className="font-extrabold text-ink">
                <LocalCount kind="streak" /> days
              </b>{' '}
              in a row
            </span>
          </span>
          <span>
            <b className="font-extrabold text-ink">
              <LocalCount kind="words" /> words
            </b>
            , <LocalCount kind="dueWords" /> to practise
          </span>
        </p>
      </div>

      <div className="mt-10 grid gap-10 @5xl/app:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] @5xl/app:gap-12">
        <div className="grid content-start gap-12">
          <section aria-labelledby="cont-h">
            <h2 id="cont-h" className="mb-4 type-h3">
              Continue reading
            </h2>
            <div className="grid gap-3">
              <StoryCardS
                href="/read/relay-team-baton-record"
                category="sports"
                inkThumb
                title="The relay team that dropped the baton, then broke the school record"
                meta="Question 3 of 5 next"
                progress={<ProgressLine value={0.6} width={120} height={10} />}
              />
              <StoryCardS
                href="/read/skate-park-mural-weekend"
                category="art"
                title="A skate park’s grey walls became a 90-metre mural in one weekend"
                meta="Paragraph 2 of 5"
                progress={<ProgressLine value={0.3} width={120} height={10} />}
              />
              <LinkButton href="/read/relay-team-baton-record" className="mt-1 justify-self-start">
                Keep reading the relay story
              </LinkButton>
            </div>
          </section>
          {/* 2 × 2, not 4-up: inside the 1.5fr column a quarter is ~150px, too narrow for "Writing" + "See all" on one line. */}
          <section aria-label="Latest by category" className="grid gap-6 @3xl/app:grid-cols-2 @3xl/app:gap-8">
            {CATEGORIES.map((c) => (
              <div key={c.slug}>
                <div className="flex flex-wrap items-center gap-x-2 border-b-[1.5px] border-ink pb-3">
                  <CategoryGlyph glyph={c.glyph} size={26} />
                  <h3 className="font-title text-[22px] leading-none font-bold">{c.name}</h3>
                  <Link href={`/c/${c.slug}`} className="ml-auto inline-flex min-h-11 items-center text-caption font-bold whitespace-nowrap underline decoration-2 underline-offset-[5px]">
                    See all<span className="sr-only"> {c.name} stories</span>
                  </Link>
                </div>
                <ul>
                  <li className="border-b border-line-soft">
                    <Link href="/read/sample" className="block min-h-12 py-3 font-read text-ui leading-[1.4] text-ink no-underline hover:underline">
                      A sample headline for {c.name.toLowerCase()} <ReadMarker slug="sample" className="ml-2" />
                    </Link>
                  </li>
                </ul>
              </div>
            ))}
          </section>
        </div>
        <aside className="grid content-start gap-6" aria-labelledby="pick-h">
          <h2 id="pick-h" className="type-h3">
            Today’s story
          </h2>
          <StoryCardL
            href="/read/comic-gran-bakery-print"
            slug="comic-gran-bakery-print"
            category="writing"
            word="manuscript"
            why="Picked from Writing, the corner you’ve read least this week."
            title="A 13-year-old’s comic about her gran’s bakery is going to print"
            minutes={4}
            newWords={4}
          />
        </aside>
      </div>
      <FreshnessLine lastSuccessAt={null} className="mt-10 text-caption text-ink-3" />
    </AppShell>
  );
}
