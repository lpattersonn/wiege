import type { ReactNode } from 'react';

import { cx } from '@/components/ui/cx';

import { Footer } from './Footer';
import { SiteNav, type SiteNavProps } from './SiteNav';
import { StickyMobileCta } from './StickyMobileCta';
import { TabBar } from './TabBar';

/**
 * Page shells. Each renders the nav, `<main id="main">` (the skip link's
 * target), and the footer, so every page gets the same landmarks.
 */

/** Landing and info pages (/, /about, /privacy, /parents, 404). */
export function SiteShell({
  children,
  nav,
  mobileCta = false,
  className,
}: {
  children: ReactNode;
  nav?: Omit<SiteNavProps, 'variant'>;
  /** Show the sticky mobile "Start reading" bar after the hero CTA scrolls away (landing). */
  mobileCta?: boolean;
  className?: string;
}) {
  return (
    <>
      <SiteNav variant="landing" {...nav} />
      <main id="main" tabIndex={-1} className={cx('outline-none', className)}>
        {children}
      </main>
      <Footer />
      {mobileCta ? <StickyMobileCta href={nav?.ctaHref} watchId={nav?.heroCtaId} /> : null}
    </>
  );
}

/**
 * App pages (/today, /c, /words, /journal, /me, /settings, /read). Content
 * sits in a 1280 container that is also the `app` container-query context
 * (`@3xl/app:` = 768px, `@5xl/app:` = 1024px). The mobile tab bar is added
 * below 768px; `hideTabBarOnScroll` for the reader.
 */
export function AppShell({
  children,
  searchHref,
  hideTabBarOnScroll = false,
  bare = false,
  className,
}: {
  children: ReactNode;
  searchHref?: string;
  hideTabBarOnScroll?: boolean;
  /** Skip the 1280 container (full-bleed pages such as the reader folio). */
  bare?: boolean;
  className?: string;
}) {
  return (
    <>
      <SiteNav variant="app" searchHref={searchHref} />
      <main id="main" tabIndex={-1} className={cx('@container/app outline-none', !bare && 'mx-auto w-full max-w-[1280px] px-(--gutter) pt-6 pb-14 md:pt-10', className)}>
        {children}
      </main>
      <Footer width="app" />
      <TabBar hideOnScroll={hideTabBarOnScroll} />
    </>
  );
}
