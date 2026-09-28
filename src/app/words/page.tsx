import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/Shells';
import { WordBank } from '@/components/words/WordBank';

/**
 * /words (SPEC §8, DESIGN §12.5): the student's saved words. A static shell;
 * the list lives on this device and hydrates into reserved space.
 */
export const metadata: Metadata = {
  title: 'Your words',
  description: 'The words you saved from stories, with pen marks that show how well you know each one. Search them, sort them and practise them with flashcards.',
  alternates: { canonical: '/words' },
  robots: { index: false, follow: true },
};

export default function WordsPage() {
  return (
    <AppShell searchHref="/c">
      <header className="mb-8 grid max-w-[760px] gap-3">
        <h1 className="type-h1">Your words</h1>
        <p className="type-lede">Words you save from stories stay here, on this device. Practise them with flashcards and watch the pen marks grow.</p>
      </header>
      <WordBank />
    </AppShell>
  );
}
