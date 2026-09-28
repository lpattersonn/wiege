import type { ReactNode } from 'react';

import { IconDevice, IconEyeOff, IconLock } from '@/components/glyphs/icons';
import { PageContainer, Section, SectionHead } from '@/components/layout/PageContainer';
import { ReadMarker } from '@/components/local/LocalCount';
import { CategoryGrid, CategoryTile } from '@/components/story/CategoryTile';
import { StoryCardM, StoryGrid } from '@/components/story/StoryCard';
import { LinkButton } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Chip';
import { FreshnessLine } from '@/components/ui/FreshnessLine';

import type { CategoryPreview, StoryPreview } from './data';

/** "Four corners of the news" (DESIGN §12.1, §11.7): real counts and the newest headline per category. */
export function CategoriesSection({ categories }: { categories: CategoryPreview[] }) {
  return (
    <Section rule labelledBy="corners-title">
      <PageContainer>
        <SectionHead
          id="corners-title"
          title="Four corners of the news."
          lede="Pick the one you’re into. Every story is rewritten at your grade, with the original always one tap away."
        />
        <CategoryGrid>
          {categories.map((c) => (
            <CategoryTile key={c.category} category={c.category} newToday={c.newToday} latest={c.latest ? [c.latest] : []} />
          ))}
        </CategoryGrid>
      </PageContainer>
    </Section>
  );
}

/**
 * The latest stories (ISR): the newest news first, practice stories only when
 * there isn't enough news, with the honest freshness line — when the last
 * ingest finished and the real countdown to the next one.
 */
export function StoriesSection({ stories, lastSuccessAt }: { stories: StoryPreview[]; lastSuccessAt: string | null }) {
  return (
    <Section id="stories" rule labelledBy="stories-title" className="scroll-mt-16">
      <PageContainer>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2 id="stories-title" className="type-h2">
            The latest stories.
          </h2>
          <FreshnessLine lastSuccessAt={lastSuccessAt} mode="at" className="max-md:min-h-11 max-md:items-start" />
        </div>
        {stories.length ? (
          <StoryGrid>
            {stories.map((story, i) => (
              <StoryCardM
                key={story.slug}
                href={`/read/${story.slug}`}
                slug={story.slug}
                title={story.title}
                category={story.category}
                word={story.word}
                summary={story.summary ?? undefined}
                minutes={story.minutes ?? undefined}
                inverted={i === 0}
                tag={story.isSample ? <Tag>Practice story</Tag> : undefined}
                status={<ReadMarker slug={story.slug} />}
                // Three cards in a two-column grid (768–1023): the lead card takes the full row.
                className={i === 0 ? 'md:col-span-2 lg:col-span-1' : undefined}
              />
            ))}
          </StoryGrid>
        ) : (
          <p className="type-lede">The first stories are on their way. New ones arrive every four hours.</p>
        )}
        <p className="mt-8">
          <LinkButton variant="ghost" href="/c">
            See all stories
          </LinkButton>
        </p>
      </PageContainer>
    </Section>
  );
}

const PROMISES: Array<{ icon: ReactNode; title: string; text: string }> = [
  {
    icon: <IconLock size={40} strokeWidth={1.6} />,
    title: 'No sign-up',
    text: 'Open Wiege and start reading. Nobody asks for your name or your email.',
  },
  {
    icon: <IconEyeOff size={40} strokeWidth={1.6} />,
    title: 'No tracking, no ads',
    text: 'No analytics, no trackers, no cookies, no chat. Every story is checked for readers aged 12 to 15 before it appears.',
  },
  {
    icon: <IconDevice size={40} strokeWidth={1.6} />,
    title: 'Your work stays with you',
    text: 'Your words, streak and journal live on this device. Save a backup file to move them, or clear them in Settings.',
  },
];

/** Privacy promises for students, parents and teachers (DESIGN §12.1, §14 protective defaults). */
export function PromisesSection() {
  return (
    <Section rule labelledBy="promises-title">
      <PageContainer>
        <SectionHead id="promises-title" title="Private by design." lede="Built for readers aged 12 to 15, so the safest choice is the default." />
        <ul className="grid gap-8 lg:grid-cols-3">
          {PROMISES.map((p) => (
            <li key={p.title} className="grid grid-cols-[40px_minmax(0,1fr)] gap-4">
              <span aria-hidden="true" className="pt-0.5">
                {p.icon}
              </span>
              <div>
                <h3 className="font-title text-[24px] leading-[1.15] font-bold">{p.title}</h3>
                <p className="mt-2 max-w-[36ch] text-nav leading-normal text-ink-2">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
        {/* Buttons don't wrap; at 320px (400% zoom) these long links must, so they stay on screen. */}
        <p className="mt-10 flex flex-wrap gap-x-10 gap-y-2">
          <LinkButton variant="ghost" href="/parents" className="max-sm:text-left max-sm:whitespace-normal">
            Read the guide for parents and teachers
          </LinkButton>
          <LinkButton variant="ghost" href="/privacy" className="max-sm:text-left max-sm:whitespace-normal">
            Read what stays on your device
          </LinkButton>
        </p>
      </PageContainer>
    </Section>
  );
}

/** Closing band (DESIGN §12.1): inverted, one action, the promise beside it. */
export function ClosingBand() {
  return (
    <section aria-labelledby="band-title" className="inv px-(--gutter) py-12 text-center md:py-20">
      <h2
        id="band-title"
        className="mx-auto max-w-[20ch] font-display text-[clamp(32px,3.6vw,44px)] leading-[1.12] font-extrabold tracking-[-0.015em] text-balance"
      >
        Your first story is already waiting.
      </h2>
      <LinkButton href="/today" className="mt-8">
        Start reading
      </LinkButton>
      <p className="mt-4 text-caption leading-[1.45]">Free. No sign-up. New stories every four hours.</p>
    </section>
  );
}
