import type { Metadata } from 'next';

import { pageMetadata } from '@/components/explore/page-metadata';
import { cardDetails } from '@/components/explore/story-details';
import { AppShell } from '@/components/layout/Shells';
import { ContinueReading } from '@/components/today/ContinueReading';
import { GradePicker } from '@/components/today/GradePicker';
import { TodayGreeting } from '@/components/today/TodayGreeting';
import { TodayLatest } from '@/components/today/TodayLatest';
import { TodayPick, type PickEntry } from '@/components/today/TodayPick';
import { TodayPractice } from '@/components/today/TodayPractice';
import { TodayRoot } from '@/components/today/TodayRoot';
import { TodayStrip } from '@/components/today/TodayStrip';
import { newestCandidate, todayScript, type PickCandidate } from '@/components/today/today-model';
import { FreshnessLine } from '@/components/ui/FreshnessLine';
import { getLastIngestSummary, getLatestByCategory, getTodaySet } from '@/lib/stories';

/**
 * /today (DESIGN §12.2, SPEC §8). A static shell, the same HTML for everyone
 * (the first-visit layout), refreshed every 10 minutes and after each ingest.
 * Everything personal (greeting, strip, Continue reading, the pick, words to
 * practise) comes from this device: see components/today/today-model.ts for
 * how it is laid out before first paint so nothing shifts.
 */
export const revalidate = 600;

export const metadata: Metadata = pageMetadata({
  title: 'Today',
  description:
    'Today’s stories in writing, games, art and sport, with one picked for you. Pick up where you left off and practise the words you’ve saved.',
  path: '/today',
});

export default async function TodayPage() {
  const [todaySet, latest, ingest] = await Promise.all([getTodaySet(), getLatestByCategory(3), getLastIngestSummary()]);
  const stories = todaySet.slice(0, 4);
  const details = await Promise.all(stories.map((story) => cardDetails(story.slug)));
  const entries: PickEntry[] = stories.map((story, i) => ({ story, details: details[i] }));
  const candidates: PickCandidate[] = stories.map((story) => ({
    slug: story.slug,
    category: story.category,
    publishedAt: Date.parse(story.publishedAt) || 0,
    isSample: story.isSample,
  }));
  const fallback = newestCandidate(candidates);

  return (
    <AppShell>
      <TodayRoot candidates={candidates} fallback={fallback} script={todayScript(candidates, fallback)}>
        <header className="grid gap-4 @5xl/app:grid-cols-[auto_minmax(0,1fr)] @5xl/app:items-end @5xl/app:gap-x-6">
          <TodayGreeting className="type-h1" />
          <div className="hidden group-data-[new=0]/today:block">
            <TodayStrip />
          </div>
          <div className="group-data-[new=0]/today:hidden @5xl/app:col-span-2">
            <GradePicker />
          </div>
        </header>

        <div className="mt-10 grid gap-10 @4xl/app:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] @4xl/app:grid-rows-[auto_1fr] @4xl/app:gap-x-12 @4xl/app:gap-y-0">
          <div className="hidden group-data-[keep=1]/today:block @4xl/app:col-start-1 @4xl/app:row-start-1 @4xl/app:pb-12">
            <ContinueReading />
          </div>
          <div className="grid content-start gap-6 @4xl/app:col-start-2 @4xl/app:row-span-2 @4xl/app:row-start-1">
            <TodayPick entries={entries} />
            <div className="hidden group-data-[due=1]/today:block">
              <TodayPractice />
            </div>
          </div>
          <div className="@4xl/app:col-start-1 @4xl/app:row-start-2">
            <TodayLatest latest={latest} />
          </div>
        </div>

        <FreshnessLine lastSuccessAt={ingest?.lastSuccessAt ?? null} className="mt-12 text-caption! text-ink-3" />
      </TodayRoot>
    </AppShell>
  );
}
