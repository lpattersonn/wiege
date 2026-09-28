'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { WordsNavLink } from '@/components/local/LocalCount';
import { cx } from '@/components/ui/cx';

import { APP_DESTINATIONS, isCurrent } from './nav-config';

/**
 * App nav links (≥ 768): Today · Explore · Words (count pill) · Journal · Me.
 * 44px pills; the current one gets a --sheet wash, --ink text and
 * aria-current="page". No filled button in the app nav.
 */
export function AppNavLinks({ className, previewPath }: { className?: string; /** Styleguide: pretend to be on this path. */ previewPath?: string }) {
  const livePath = usePathname();
  const pathname = previewPath ?? livePath;
  return (
    <nav aria-label={previewPath ? 'App (preview)' : 'App'} className={cx('hidden items-center gap-1 md:flex', className)}>
      {APP_DESTINATIONS.map((dest) => {
        const current = isCurrent(pathname, dest);
        if (dest.href === '/words') return <WordsNavLink key={dest.href} variant="app" current={current} />;
        return (
          <Link
            key={dest.href}
            href={dest.href}
            aria-current={current ? 'page' : undefined}
            className={cx(
              'inline-flex min-h-11 items-center rounded-pill px-4 text-small font-bold no-underline transition-[background-color,color] duration-160',
              current ? 'bg-sheet text-ink' : 'text-ink-2 hover:bg-sheet hover:text-ink',
            )}
          >
            {dest.label}
          </Link>
        );
      })}
    </nav>
  );
}
