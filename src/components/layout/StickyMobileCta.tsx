'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { buttonClasses } from '@/components/ui/Button';

/**
 * Sticky mobile CTA bar (DESIGN §11.8, landing < 768): hidden until the hero
 * CTA (`watchId`) has scrolled above the viewport, then slides up in 200ms.
 * One 48px block button; paper at 95% with an 8px blur. The page gets
 * matching bottom padding automatically; hidden at 768 and up.
 */
export function StickyMobileCta({ href = '/today', label = 'Start reading', watchId = 'hero-cta' }: { href?: string; label?: string; watchId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = ref.current;
    const target = document.getElementById(watchId);
    if (!bar || !target || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      bar.dataset.show = show ? 'true' : 'false';
      bar.inert = !show;
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);
  return (
    <div
      ref={ref}
      data-mobile-cta=""
      data-show="false"
      inert
      className="mobile-cta fixed inset-x-0 bottom-0 z-45 border-t border-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-[color-mix(in_srgb,var(--paper)_95%,transparent)] px-(--gutter) pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-sm md:hidden"
    >
      <Link href={href} className={buttonClasses({ variant: 'primary', block: true })}>
        {label}
      </Link>
    </div>
  );
}
