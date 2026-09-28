import type { ReactNode } from 'react';

import { Footer } from '@/components/layout/Footer';
import { SiteNav } from '@/components/layout/SiteNav';
import { TabBar } from '@/components/layout/TabBar';

/**
 * The app shell for the reader: the same parts as <AppShell> (app nav, main,
 * footer, the mobile tab bar that hides while scrolling down), but at the
 * page width (1440). The reader's folio needs it (DESIGN §5.2, §5.3: 216 |
 * text | 312 with a full 32em measure), and the nav lines up with it.
 */
export function ReaderShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav variant="app" width="page" />
      <main id="main" tabIndex={-1} className="@container/app outline-none">
        {children}
      </main>
      <Footer width="page" />
      <TabBar hideOnScroll />
    </>
  );
}
