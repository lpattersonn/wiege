import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { IconBack } from '@/components/glyphs/icons';
import { NewEntry } from '@/components/journal/NewEntry';
import { NEW_ENTRY_GATE_SCRIPT, NewEntryPicker, NewEntrySkeleton, type TodayStory } from '@/components/journal/NewEntryParts';
import { AppShell } from '@/components/layout/Shells';
import { StoreGate } from '@/components/words/StoreGate';
import { getTodaySet } from '@/lib/stories';

/**
 * /journal/new (SPEC §8, DESIGN §12.6): pick a prompt from one of today's
 * stories (or `?story=<slug>`), or free write, then the editor. Static with
 * ISR for today's stories; the URL is read on the device.
 */
export const revalidate = 600;

export const metadata: Metadata = {
  title: 'New journal entry',
  description: 'Start a new journal entry: answer a prompt from one of today’s stories, or write about anything you like. It saves on this device as you type.',
  alternates: { canonical: '/journal/new' },
  robots: { index: false, follow: true },
};

export default async function NewEntryPage() {
  const today: TodayStory[] = (await getTodaySet()).map((s) => ({ slug: s.slug, category: s.category, title: s.title }));
  return (
    <AppShell searchHref="/c">
      <header className="mb-10 grid gap-4">
        <Link href="/journal" className="-ml-1 inline-flex min-h-11 items-center gap-1 justify-self-start text-small font-bold text-ink no-underline hover:underline hover:decoration-2 hover:underline-offset-[5px]">
          <IconBack size={20} />
          Journal
        </Link>
        <div className="grid max-w-[760px] gap-3">
          <h1 className="type-h1">New entry</h1>
          <p className="type-lede">Answer a prompt from one of today’s stories, or write about anything you like. It saves on this device as you type.</p>
        </div>
      </header>
      <div className="min-h-[60svh]">
        <Suspense
          fallback={
            <StoreGate id="new-entry-gate" script={NEW_ENTRY_GATE_SCRIPT} variants={{ empty: <NewEntryPicker today={today} /> }} fallback={<NewEntrySkeleton />} />
          }
        >
          <NewEntry today={today} />
        </Suspense>
      </div>
    </AppShell>
  );
}
