'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/glyphs/icons';
import { useDueCount } from '@/components/local/hooks';
import { TabUnderline } from '@/components/pen/marks';
import { CountPill } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';

import { APP_DESTINATIONS, isCurrent } from './nav-config';

/**
 * Mobile tab bar (DESIGN §11.8), app pages under 768px: 56px plus the safe
 * area, five equal tabs, 22px icon over a 12px 700 label; idle --ink-3,
 * current --ink with a 28px pen underline (drawn once on change). Words shows
 * the due-count badge. Paper at 94% with a 12px blur and a 10% hairline.
 * `hideOnScroll` (the reader): hides while scrolling down, returns on scroll
 * up and at the end of the page. Pages get bottom padding automatically.
 */
export function TabBar({ hideOnScroll = false, preview = false, previewPath }: { hideOnScroll?: boolean; /** Static, in-flow rendering for the styleguide. */ preview?: boolean; previewPath?: string }) {
  const livePath = usePathname();
  const pathname = previewPath ?? livePath;
  const [firstPath] = useState(pathname);
  const due = useDueCount();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const bar = ref.current;
    if (!bar || !hideOnScroll) return;
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 8;
      const down = y > last + 4;
      const up = y < last - 4;
      if (atEnd || up || y < 56) bar.dataset.hidden = 'false';
      else if (down) bar.dataset.hidden = 'true';
      last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      bar.dataset.hidden = 'false';
    };
  }, [hideOnScroll]);

  return (
    <nav
      ref={ref}
      aria-label={preview ? 'Tab bar (preview)' : 'App'}
      data-tabbar={preview ? undefined : ''}
      data-hidden="false"
      className={cx(
        'tabbar grid grid-cols-5',
        preview ? 'relative' : 'fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden',
        'border-t border-[color-mix(in_srgb,var(--ink)_10%,transparent)] bg-[color-mix(in_srgb,var(--paper)_94%,transparent)] backdrop-blur-md',
      )}
    >
      {APP_DESTINATIONS.map((dest) => {
        const current = isCurrent(pathname, dest);
        const showBadge = dest.href === '/words' && due !== null && due > 0;
        return (
          <Link
            key={dest.href}
            href={dest.href}
            aria-current={current ? 'page' : undefined}
            className={cx(
              'relative grid min-h-14 content-center justify-items-center gap-0.5 text-micro leading-[14px] font-bold no-underline',
              current ? 'text-ink' : 'text-ink-3 hover:text-ink',
            )}
          >
            <Icon name={dest.icon} size={22} />
            {dest.label}
            {showBadge ? (
              <>
                <CountPill value={due} size={18} tick className="absolute top-1.5 left-[calc(50%+6px)]" />
                <span className="sr-only">, {due} to practise</span>
              </>
            ) : null}
            {current ? (
              <span key={pathname} className="absolute bottom-[5px] left-1/2 -translate-x-1/2">
                <TabUnderline animate={pathname !== firstPath} />
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
