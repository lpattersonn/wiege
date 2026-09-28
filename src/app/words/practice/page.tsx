import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SiteNav } from '@/components/layout/SiteNav';
import { WordsEmpty } from '@/components/words/parts';
import { PracticeSession, PracticeSkeleton, PracticeTopBar } from '@/components/words/PracticeSession';
import { gateScript, NO_WORDS, StoreGate } from '@/components/words/StoreGate';

/**
 * /words/practice (SPEC §8, DESIGN §11.19, §12.5): a flashcard round. Static
 * shell; the round is built on this device. Full screen on mobile (no tab
 * bar, a close button); a centred 560 column under the app nav from 768px.
 */
export const metadata: Metadata = {
  title: 'Practise your words',
  description: 'A flashcard round with your saved words: say what each word means, flip the card, and grade how well you knew it.',
  alternates: { canonical: '/words/practice' },
  robots: { index: false, follow: true },
};

export default function PracticePage() {
  return (
    <>
      <div className="hidden md:block">
        <SiteNav variant="app" searchHref="/c" />
      </div>
      <main id="main" tabIndex={-1} className="mx-auto min-h-[100svh] w-full max-w-[calc(560px+2*var(--gutter))] px-(--gutter) pt-3 pb-14 outline-none md:min-h-[80svh] md:pt-10">
        <Suspense
          fallback={
            <StoreGate
              id="practice-gate"
              script={gateScript('practice-gate', NO_WORDS)}
              variants={{
                empty: (
                  <div className="grid gap-6">
                    <PracticeTopBar />
                    <WordsEmpty />
                  </div>
                ),
              }}
              fallback={
                <div className="grid gap-6">
                  <PracticeTopBar />
                  <PracticeSkeleton />
                </div>
              }
            />
          }
        >
          <PracticeSession />
        </Suspense>
      </main>
    </>
  );
}
