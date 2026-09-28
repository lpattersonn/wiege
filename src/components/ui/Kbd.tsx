import type { ReactNode } from 'react';

/** A keyboard key, e.g. <Kbd>Space</Kbd>. Atkinson, never monospace. */
export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex min-w-7 items-center justify-center rounded-paper border-[1.5px] border-line-control bg-sheet px-2 font-ui text-caption leading-6 font-bold text-ink ${className}`}
    >
      {children}
    </kbd>
  );
}
