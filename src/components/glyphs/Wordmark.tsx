import Link from 'next/link';

import { ROCKER_D } from './wordmark-outline';

/**
 * "Wiege" in Bodoni 900 over a fixed cradle rocker (DESIGN §9). The rocker is
 * part of the logo, not a pen mark: it never animates. 30px in the site nav,
 * 26px in the app bar and footer.
 */
export interface WordmarkProps {
  /** Font size in px: 30 (site nav, default) or 26 (app bar). */
  size?: number;
  /** Renders a home link ("Wiege, home") when set. */
  href?: string;
  className?: string;
}

function Mark({ size }: { size: number }) {
  return (
    <>
      <span
        className="font-display font-black leading-none"
        style={{ fontSize: size, letterSpacing: '-0.01em' }}
        aria-hidden={true}
      >
        Wiege
      </span>
      <svg
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
        className="absolute -left-[3px] bottom-0.5 h-[9px] w-[calc(100%+8px)] overflow-visible"
      >
        <path d={ROCKER_D} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </>
  );
}

export function Wordmark({ size = 30, href, className = '' }: WordmarkProps) {
  const base = `relative inline-flex min-h-11 items-center pb-1 text-ink no-underline ${className}`;
  if (href) {
    return (
      <Link href={href} className={base} aria-label="Wiege, home">
        <Mark size={size} />
      </Link>
    );
  }
  return (
    <span className={base} role="img" aria-label="Wiege">
      <Mark size={size} />
    </span>
  );
}
