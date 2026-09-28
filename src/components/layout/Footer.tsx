import Link from 'next/link';

import { Wordmark } from '@/components/glyphs/Wordmark';
import { ThemeSwitch } from '@/components/local/ThemeSwitch';
import { cx } from '@/components/ui/cx';

import { FOOTER_LINKS } from './nav-config';

/**
 * Footer (DESIGN §12.1): wordmark and one line, two columns of links (44px
 * rows on mobile), and the System | Light | Dark theme switch.
 */
export function Footer({ width = 'page', className }: { width?: 'page' | 'app'; className?: string }) {
  return (
    <footer className={cx('border-t border-line-soft', className)}>
      <div
        className={cx(
          'mx-auto grid gap-8 px-(--gutter) py-12 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start lg:gap-16',
          width === 'app' ? 'max-w-[1280px]' : 'max-w-[1440px]',
        )}
      >
        <div>
          <Wordmark href="/" size={26} />
          <p className="mt-3 max-w-[40ch] text-small text-ink-3">
            Wiege is German for cradle: the place where things begin. Stories are retold for readers; the original is always linked.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-[repeat(2,minmax(0,max-content))] gap-x-10">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="flex min-h-11 items-center font-semibold text-ink no-underline hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
        <ThemeSwitch />
      </div>
    </footer>
  );
}
