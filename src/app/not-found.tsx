import type { Metadata } from 'next';

import { SiteShell } from '@/components/layout/Shells';
import { StatusPage } from '@/components/layout/StatusPage';
import { LinkButton } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <SiteShell>
      <StatusPage word="moved" title="This page has moved on." action={<LinkButton href="/today">See today’s stories</LinkButton>}>
        The link may be out of date. Today’s stories are one tap away.
      </StatusPage>
    </SiteShell>
  );
}
