import type { Metadata } from 'next';

import { StatusPage } from '@/components/layout/StatusPage';
import { ReaderShell } from '@/components/reader/ReaderShell';
import { LinkButton } from '@/components/ui/Button';

/** A story that was removed (news stays 120 days) or never existed (DESIGN §10, §12.10). */
export const metadata: Metadata = {
  title: 'This story has moved on',
  description: 'News stays on Wiege for 120 days. Today’s stories are one tap away.',
  robots: { index: false, follow: true },
};

export default function StoryNotFound() {
  return (
    <ReaderShell>
      <StatusPage word="moved" title="This story has moved on." action={<LinkButton href="/today">See today’s stories</LinkButton>}>
        News stays on Wiege for 120 days. Your saved words and writing from it are still on this device.
      </StatusPage>
    </ReaderShell>
  );
}
