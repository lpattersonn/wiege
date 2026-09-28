'use client';

import { useEffect } from 'react';

import { SiteShell } from '@/components/layout/Shells';
import { StatusPage } from '@/components/layout/StatusPage';
import { Button } from '@/components/ui/Button';

/**
 * Route error boundary (DESIGN §12.10): the word "hiccup" with a pen cross,
 * what happened and what to do, and one action that retries the segment.
 * It keeps the site nav and footer (like the 404), so there is always a way
 * on. Error boundaries can't export metadata, so the title and robots tags
 * are React 19 head elements. Errors in the root layout reach global-error.
 */
export default function ErrorPage({ error, reset, retry }: { error: Error & { digest?: string }; reset: () => void; retry?: () => void }) {
  useEffect(() => {
    console.error('[wiege] page error', error.digest ?? error.message);
  }, [error]);

  return (
    <SiteShell>
      <title>This page didn’t load – Wiege</title>
      <meta name="robots" content="noindex" />
      <StatusPage
        word="hiccup"
        mark="cross"
        title="This page didn’t load."
        action={
          <Button variant="primary" onClick={() => (retry ?? reset)()}>
            Try again
          </Button>
        }
      >
        Check your connection, then try again.
      </StatusPage>
    </SiteShell>
  );
}
