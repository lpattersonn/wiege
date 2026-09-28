'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { buttonClasses } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';

/**
 * The nav's "Start reading" (DESIGN §11.1): outlined while the hero CTA
 * (`watchId`) is on screen, filled once it has scrolled away (200ms), so there
 * is never more than one filled action in view. Stays outlined on pages
 * without a hero CTA.
 */
export function NavCta({ href = '/today', label = 'Start reading', watchId = 'hero-cta', className }: { href?: string; label?: string; watchId?: string; className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = ref.current;
    if (!link) return;
    const target = document.getElementById(watchId);
    // No hero CTA on this page: stay outlined, so the page's own primary action is the only filled one.
    if (!target || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      link.dataset.filled = entry.isIntersecting ? 'false' : 'true';
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);
  return (
    <Link
      ref={ref}
      href={href}
      data-filled="false"
      className={cx(
        buttonClasses({ variant: 'secondary', size: 'sm' }),
        'duration-200 data-[filled=true]:bg-ink data-[filled=true]:text-paper data-[filled=true]:hover:bg-ink-2 data-[filled=true]:hover:border-ink-2',
        className,
      )}
    >
      {label}
    </Link>
  );
}
