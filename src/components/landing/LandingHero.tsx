import { Folio, FolioLeft, PageContainer } from '@/components/layout/PageContainer';
import { AsideArrow } from '@/components/pen/marks';
import { LinkButton } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Chip';
import { MetaCategory, MetaItem, MetaMinutes, MetaRow } from '@/components/ui/MetaRow';

import type { HeroDemo as HeroDemoData } from './hero-demo';
import { HeroDemo } from './HeroDemo';

/**
 * Landing hero (DESIGN §12.1): the pitch (the page's h1) and the one filled
 * action in the left margin, the practice story's poster headline and its
 * tap-a-word passage in the text column, word notes in the right margin.
 * Below 1024px everything stacks: pitch, "Start reading", then the demo.
 */
export function LandingHero({ demo }: { demo: HeroDemoData }) {
  const head = (
    <>
      <MetaRow>
        <Tag>Practice story</Tag>
        <MetaCategory slug={demo.category} />
        <MetaMinutes minutes={demo.minutes} />
        <MetaItem>Grade 7–8</MetaItem>
      </MetaRow>
      <h2 className="mt-4 type-display-xl">{demo.title}</h2>
    </>
  );

  return (
    <section aria-labelledby="pitch" className="pt-8 pb-16 lg:pt-12 lg:pb-28">
      <PageContainer>
        {/* At ≥ 1024 the word note sits in an overlay layer of the margin, so opening it
            (including the automatic first one) never moves the page. The text column keeps
            room for the tallest note: measured 533px from its top at 1279px, less the 88px
            the section's bottom padding can take. */}
        <Folio className="lg:[&_[data-folio-main]]:min-h-[460px]">
          <FolioLeft className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-x-12 xl:block">
            <div>
              <h1 id="pitch" className="max-w-[30ch] type-lead-ui">
                Real news every four hours, turned into reading practice for ages 12 to 15.
              </h1>
              <p className="mt-2 max-w-[36ch] text-nav leading-normal text-ink-2">
                Writing, games, art and sport. Tap any word you don’t know, answer a question, write back.
              </p>
            </div>
            <div className="mt-6 grid justify-items-start gap-3 lg:mt-0 xl:mt-6">
              <LinkButton href="/today" id="hero-cta">
                Start reading
              </LinkButton>
              <p className="max-w-[28ch] text-caption leading-[1.45] text-ink-3">Free. No sign-up. Your progress stays on this device.</p>
            </div>
            <p aria-hidden="true" className="mt-7 flex items-end gap-1 lg:hidden xl:mt-10 xl:flex xl:flex-col xl:items-start">
       <span className="type-hand">try it: tap a dotted word</span>
              <AsideArrow direction="down" className="xl:hidden" />
              <AsideArrow direction="right" className="-mt-0.5 ml-20 hidden xl:block" />
            </p>
          </FolioLeft>
          <HeroDemo demo={{ slug: demo.slug, title: demo.title, passage: demo.passage, notes: demo.notes }} head={head} />
        </Folio>
      </PageContainer>
    </section>
  );
}
