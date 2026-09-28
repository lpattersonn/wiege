import type { Metadata } from 'next';
import Link from 'next/link';

import { IconBack } from '@/components/glyphs/icons';
import { EntryEditor, EntryTitle } from '@/components/journal/EntryEditor';
import { AppShell } from '@/components/layout/Shells';

/**
 * /journal/[id] (SPEC §8, DESIGN §12.6): one journal entry with the editor,
 * autosave, word count, notes and delete. Entries live on this device, so
 * this is a static shell (rendered once per id, then cached) that hydrates
 * from the local store; an unknown id shows a friendly "not on this device".
 */
export function generateStaticParams(): Array<{ id: string }> {
  return [];
}

export async function generateMetadata({ params }: PageProps<'/journal/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return {
    title: 'Journal entry',
    description: 'One of your journal entries, saved on this device: keep writing, check your word count and get notes on your writing.',
    alternates: { canonical: `/journal/${encodeURIComponent(id)}` },
    robots: { index: false, follow: true },
  };
}

export default async function JournalEntryPage({ params }: PageProps<'/journal/[id]'>) {
  const { id } = await params;
  return (
    <AppShell searchHref="/c">
      <header className="mb-8 grid gap-4 xl:mb-10">
        <Link href="/journal" className="-ml-1 inline-flex min-h-11 items-center gap-1 justify-self-start text-small font-bold text-ink no-underline hover:underline hover:decoration-2 hover:underline-offset-[5px]">
          <IconBack size={20} />
          Journal
        </Link>
        <EntryTitle id={id} className="type-h2 max-w-[24ch] xl:ml-[calc(216px+48px)]" />
      </header>
      <EntryEditor id={id} />
    </AppShell>
  );
}
