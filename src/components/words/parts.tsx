import { MASTERY_LEVELS, MarkedWord } from '@/components/pen/MasteryMark';
import { LinkButton } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/**
 * Static pieces of the word bank (DESIGN §12.5), safe to render on the server
 * (the pre-hydration gate) and inside the client islands.
 */

/** Empty word bank (DESIGN §10): what will live here, how to fill it, one action. */
export function WordsEmpty({ headingLevel = 'h2' }: { headingLevel?: 'h2' | 'h3' }) {
  return (
    <EmptyState
      sketch="words"
      title="Your words will live here."
      headingLevel={headingLevel}
      action={<LinkButton href="/today">Read today’s story</LinkButton>}
    >
      Tap any dotted word in a story, then Save word. It shows up here with a pen mark that grows as you practise.
    </EmptyState>
  );
}

/** Same-size placeholder for the word bank while the store loads. */
export function WordsSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton width={260} height={22} />
        <Skeleton width={200} height={48} round />
      </div>
      <div className="grid gap-10 @5xl/app:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] @5xl/app:gap-14">
        <div className="grid content-start gap-5">
          <div className="flex flex-wrap gap-3">
            <Skeleton width="min(100%, 360px)" height={48} />
            <Skeleton width={260} height={48} round />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid gap-3 border-b border-line-soft py-4">
              <Skeleton width={160 + ((i * 37) % 80)} height={31} />
              <SkeletonText lines={1} lineHeight={23} />
            </div>
          ))}
        </div>
        <Skeleton className="hidden @5xl/app:block" height={360} />
      </div>
    </div>
  );
}

/** One sample "word" wearing a mastery mark. */
function Sample({ level, className }: { level: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('font-title font-bold text-ink', className)}>
      <MarkedWord word="word" level={level} scope="legend" />
    </span>
  );
}

/** Compact legend row under the tools (below 1024px). */
export function MasteryLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="What the pen marks mean" className={cx('flex flex-wrap gap-x-5 gap-y-3 text-caption text-ink-2', className)}>
      {MASTERY_LEVELS.map((m) => (
        <li key={m.level} className="inline-flex items-center gap-2">
          <Sample level={m.level} className="text-[17px] leading-[1.2]" />
          {m.label}
        </li>
      ))}
    </ul>
  );
}

/** The mastery ladder with the student's own counts (≥ 1024px, right column). */
export function MarksLadder({ counts, headingId }: { counts: readonly number[]; headingId: string }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <h2 id={headingId} className="type-h4">
          Your pen marks
        </h2>
        <p className="text-caption text-ink-2">The mark on a word shows how well you know it. It moves up when you practise.</p>
      </div>
      <ul className="grid">
        {MASTERY_LEVELS.map((m, i) => (
          <li key={m.level} className="grid min-h-16 grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line-soft py-3">
            <Sample level={m.level} className="justify-self-start text-[24px] leading-[1.2]" />
            <span className="text-small font-bold text-ink">
              {m.label}
              <small className="block text-caption font-normal text-ink-3">{m.next}</small>
            </span>
            <span className="text-small text-ink-2">
              <b className="num font-extrabold text-ink">{counts[i] ?? 0}</b> {counts[i] === 1 ? 'word' : 'words'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
