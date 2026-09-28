import Link from 'next/link';

import { IconSearch } from '@/components/glyphs/icons';
import { Wordmark } from '@/components/glyphs/Wordmark';
import { WordsNavLink } from '@/components/local/LocalCount';

import { AppNavLinks } from './AppNavLinks';
import { LandingMenu } from './LandingMenu';
import { NavCta } from './NavCta';
import { SITE_LINKS } from './nav-config';
import { StickyHeader } from './StickyHeader';

/**
 * Site navigation (DESIGN §11.8).
 *
 * - `variant="landing"` (landing and info pages): wordmark, up to three text
 *   links, the Words count link and the "Start reading" CTA (outlined while
 *   the hero CTA `#hero-cta` is visible, then filled). Below 1024px: wordmark,
 *   the 40px CTA and a 44px menu button that opens the drawer.
 * - `variant="app"` (Today, Explore, Words, Journal, Me): wordmark (26px) and
 *   the five destination pills from 768px, plus an optional search button;
 *   below 768px a 56px app bar (the TabBar carries navigation).
 */
export interface SiteNavProps {
  variant?: 'landing' | 'app';
  /** Landing variant: override the three text links. */
  links?: ReadonlyArray<{ href: string; label: string }>;
  /** Landing variant: the CTA's destination. */
  ctaHref?: string;
  /** Element id whose visibility keeps the nav CTA outlined (the hero CTA). */
  heroCtaId?: string;
  /** App variant: where the search button goes. Omit to hide the button. */
  searchHref?: string;
  /** Max width of the bar's content: 1440 (landing) or 1280 (app). */
  width?: 'page' | 'app';
}

export function SiteNav({ variant = 'landing', links = SITE_LINKS, ctaHref = '/today', heroCtaId = 'hero-cta', searchHref, width }: SiteNavProps) {
  const max = (width ?? (variant === 'app' ? 'app' : 'page')) === 'app' ? 'max-w-[1280px]' : 'max-w-[1440px]';
  if (variant === 'app') {
    return (
      <StickyHeader>
        <div className={`site-header-row mx-auto flex h-14 w-full items-center gap-4 px-(--gutter) md:h-16 ${max}`}>
          <Wordmark href="/" size={26} />
          <AppNavLinks className="ml-6" />
          <span className="ml-auto" />
          {searchHref ? (
            <Link
              href={searchHref}
              aria-label="Search stories"
              className="inline-grid size-11 place-items-center rounded-pill border-[1.5px] border-line-control text-ink no-underline hover:border-ink hover:bg-sheet"
            >
              <IconSearch />
            </Link>
          ) : null}
        </div>
      </StickyHeader>
    );
  }
  return (
    <StickyHeader>
      <div className={`site-header-row mx-auto flex h-14 w-full items-center gap-6 px-(--gutter) md:h-16 ${max}`}>
        <Wordmark href="/" className="mr-auto" />
        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-nav font-semibold text-ink no-underline hover:underline hover:decoration-2 hover:underline-offset-[6px]">
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="hidden lg:contents">
          <WordsNavLink />
        </span>
        {/* Under 360px (320px reflow, 400% zoom) the row can't fit wordmark + CTA + menu: the CTA
            steps aside. It is still the drawer's last row and the hero's first action. */}
        <NavCta href={ctaHref} watchId={heroCtaId} className="max-[359px]:hidden" />
        <LandingMenu links={links} ctaHref={ctaHref} />
      </div>
    </StickyHeader>
  );
}
