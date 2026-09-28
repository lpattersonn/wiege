import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/Shells';
import { LocalCount } from '@/components/local/LocalCount';
import { BackupPanel } from '@/components/me/BackupPanel';
import { LevelSummary } from '@/components/me/LevelSummary';
import { ReadingCalendar } from '@/components/me/ReadingCalendar';
import { StampWall } from '@/components/me/StampWall';
import { StreakPage } from '@/components/me/StreakPage';
import { LinkButton } from '@/components/ui/Button';
import { StatGrid, StatTile } from '@/components/ui/StatTile';

export const metadata: Metadata = {
  title: 'Me',
  description: 'Your level, reading streak, 12-week reading calendar and stamps. It all stays on this device, and you can save a backup file any time.',
  alternates: { canonical: '/me' },
  robots: { index: false, follow: true },
};

/**
 * /me (SPEC §8, DESIGN §12.7): level and XP, four stat tiles, the streak and
 * 12-week calendar spread, the stamps wall and the backup reminder.
 *
 * A static shell: everything personal comes from the on-device store in small
 * client islands that render same-size placeholders until they hydrate.
 */
export default function MePage() {
  return (
    <AppShell searchHref="/c">
      <div className="flex items-start justify-between gap-4">
        <h1 className="type-h1">Me</h1>
        <LinkButton href="/settings" variant="secondary" size="sm" className="mt-2 md:mt-4">
          Settings
        </LinkButton>
      </div>

      <p className="mt-3 type-lede">Your level, streak, reading days and stamps. It all lives on this device, and it’s all yours.</p>

      <div className="mt-8">
        <LevelSummary />
      </div>

      <section aria-labelledby="me-stats-h" className="mt-10 md:mt-12">
        <h2 id="me-stats-h" className="sr-only">
          Your numbers
        </h2>
        <StatGrid className="auto-rows-fr">
          <StatTile value={<LocalCount kind="storiesRead" />} label="Stories read" />
          <StatTile value={<LocalCount kind="words" />} label="Words collected" />
          <StatTile value={<LocalCount kind="journalEntries" />} label="Journal entries" />
          <StatTile value={<LocalCount kind="bestStreak" />} label="Best streak, in days" />
        </StatGrid>
      </section>

      {/* The notebook spread: a 1.5px ink spine between the pages from 1024px. */}
      <div className="mt-14 grid gap-14 border-t border-line-soft pt-12 lg:mt-20 lg:grid-cols-2 lg:gap-0 lg:pt-16">
        <section aria-labelledby="me-days-h" className="min-w-0 lg:pr-14">
          <StreakPage headingId="me-days-h" />
        </section>
        <section aria-labelledby="me-weeks-h" className="min-w-0 lg:border-l-[1.5px] lg:border-ink lg:pl-14">
          <ReadingCalendar headingId="me-weeks-h" />
        </section>
      </div>

      <section aria-labelledby="me-stamps-h" className="mt-14 border-t border-line-soft pt-12 lg:mt-20 lg:pt-16">
        <StampWall headingId="me-stamps-h" />
      </section>

      <section aria-labelledby="me-backup-h" className="mt-14 lg:mt-20">
        <BackupPanel headingId="me-backup-h" />
      </section>
    </AppShell>
  );
}
