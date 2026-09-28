'use client';

import Link from 'next/link';
import { useState } from 'react';

import { IconMenu } from '@/components/glyphs/icons';
import { WordsNavLink } from '@/components/local/LocalCount';
import { buttonClasses, IconButton } from '@/components/ui/Button';

import { Drawer } from './Drawer';
import { SITE_LINKS } from './nav-config';

/**
 * The landing / info menu below 1024px: a 44px menu button and the drawer
 * (48px rows, Atkinson 700 18, the Words count row, then the CTA as a block
 * button at the bottom).
 */
export function LandingMenu({ links = SITE_LINKS, ctaHref = '/today', ctaLabel = 'Start reading' }: { links?: ReadonlyArray<{ href: string; label: string }>; ctaHref?: string; ctaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <IconButton label="Open menu" icon={<IconMenu />} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)} className="lg:hidden" />
      <Drawer open={open} onClose={close} label="Menu">
        <nav aria-label="Main" className="grid">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={close} className="flex min-h-12 items-center border-b border-line-soft text-choice font-bold text-ink no-underline hover:underline">
              {link.label}
            </Link>
          ))}
          <WordsNavLink variant="drawer" onClick={close} className="border-b border-line-soft" />
        </nav>
        <div className="mt-auto pt-8">
          <Link href={ctaHref} onClick={close} className={buttonClasses({ variant: 'primary', block: true })}>
            {ctaLabel}
          </Link>
        </div>
      </Drawer>
    </>
  );
}
