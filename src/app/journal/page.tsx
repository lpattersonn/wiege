import type { Metadata } from 'next';

import { IconPlus } from '@/components/glyphs/icons';
import { JournalList } from '@/components/journal/JournalList';
import { AppShell } from '@/components/layout/Shells';
import { LinkButton } from '@/components/ui/Button';
import { getTodaySet } from '@/lib/stories';

/**
 * /journal (SPEC §8, DESIGN §12.6): the student's writing, newest first.
 * The entries live on this device, so the list hydrates into reserved space;
 * the page itself is static (ISR only for the "today's story" link).
 */
export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Journal',
  description: 'Your answers to story prompts and your free writes, saved on this device as you type, with notes on your writing when you ask for them.',
  alternates: { canonical: '/journal' },
  robots: { index: false, follow: true },
};

export default async function JournalPage() {
  const today = await getTodaySet();
  const startHref = today[0] ? `/journal/new?story=${encodeURIComponent(today[0].slug)}` : '/journal/new';
  return (
    <AppShell searchHref="/c">
      <header className="mb-10 grid gap-6 @3xl/app:grid-cols-[minmax(0,1fr)_auto] @3xl/app:items-end @3xl/app:gap-10">
        <div className="grid max-w-[760px] gap-3">
          <h1 className="type-h1">Journal</h1>
          <p className="type-lede">Your answers to story prompts and your free writes, saved as you type. Open one to keep writing or to get notes on it.</p>
        </div>
        <LinkButton href="/journal/new" icon={<IconPlus />} className="max-md:w-full">
          New entry
        </LinkButton>
      </header>
      <JournalList startHref={startHref} />
    </AppShell>
  );
}
