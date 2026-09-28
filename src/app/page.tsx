import type { Metadata } from 'next';

import { getLandingData } from '@/components/landing/data';
import { buildHeroDemo } from '@/components/landing/hero-demo';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LandingHero } from '@/components/landing/LandingHero';
import { buildLessonTour } from '@/components/landing/lesson-tour';
import { Notebook } from '@/components/landing/Notebook';
import { CategoriesSection, ClosingBand, PromisesSection, StoriesSection } from '@/components/landing/sections';
import { SiteShell } from '@/components/layout/Shells';
import { getLandingDemoStory } from '@/lib/literacy/samples';

/**
 * The landing page (SPEC §8 "/", DESIGN §12.1). Static, regenerated every 10
 * minutes and after each ingest (the story queries are tagged `stories`).
 * Only the hero's tap-a-word demo, the freshness countdown, the read markers
 * and the site chrome hydrate; everything else is server HTML.
 */
export const revalidate = 600;

const TITLE = 'Wiege: real news, turned into reading practice for ages 12 to 15';
const DESCRIPTION =
  'Real news every four hours, rewritten at your grade and turned into reading practice for ages 12 to 15. Tap any word you don’t know, answer a question, write back. Free, with no sign-up.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'Wiege', locale: 'en', url: '/', title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default async function Home() {
  const story = getLandingDemoStory();
  const demo = buildHeroDemo(story);
  const tour = buildLessonTour(story);
  const data = await getLandingData();
  const vocabulary = story.content.vocabulary.map((v) => v.word).filter((w) => !/\s/.test(w));

  return (
    <SiteShell mobileCta>
      <LandingHero demo={demo} />
      <CategoriesSection categories={data.categories} />
      <StoriesSection stories={data.stories} lastSuccessAt={data.lastSuccessAt} />
      <HowItWorks tour={tour} storyTitle={demo.title} />
      <Notebook
        example={{
          words: vocabulary.length >= 5 ? vocabulary.slice(0, 5) : ['gleam', 'stamina', 'rehearse', 'momentum', 'narrative'],
          journal: tour.write ? { title: demo.title, kind: tour.write.kind === 'opinion' ? 'Opinion' : 'Writing', words: tour.write.words } : null,
        }}
      />
      <PromisesSection />
      <ClosingBand />
    </SiteShell>
  );
}
