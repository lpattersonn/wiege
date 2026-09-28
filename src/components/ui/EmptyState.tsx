import type { ReactNode } from 'react';

import { CARET } from '@/components/pen/pen';

import { cx } from './cx';

/**
 * Empty state (DESIGN §11.17): a dashed --ink-3 sketch of what will live
 * here, a one-line heading (Bodoni 800 26), one sentence (17 --ink-2) and
 * exactly one action. Centred in the content column, 64px vertical padding.
 */
export interface EmptyStateProps {
  /** 'words' | 'journal' built-in sketches, or your own node. */
  sketch?: 'words' | 'journal' | ReactNode;
  title: string;
  children: ReactNode;
  /** Exactly one action (a LinkButton or Button). */
  action?: ReactNode;
  /** Heading level (default h2). */
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4';
  className?: string;
}

/** Three dotted-underlined sample words in a dashed frame. */
export function EmptySketchWords() {
  return (
    <div aria-hidden="true" className="grid w-[220px] gap-2 rounded-paper border-[1.5px] border-dashed border-ink-3 px-6 py-5 text-left">
      {['gleam', 'stamina', 'rehearse'].map((word) => (
        <span key={word} className="font-title text-[26px] leading-[1.2] font-bold text-ink-3">
          <span className="dotted">{word}</span>
        </span>
      ))}
    </div>
  );
}

/** A ruled page with a caret. */
export function EmptySketchJournal() {
  return (
    // A sketch, not a pen mark: no .pm-static, so the dark-mode gel sheen (the system's only filter) stays on real marks.
    <svg aria-hidden="true" viewBox="0 0 220 150" width={220} height={150} fill="none" strokeLinecap="round" strokeLinejoin="round" className="block overflow-visible text-ink-3">
      <rect x="1" y="1" width="218" height="148" rx="4" fill="none" style={{ stroke: 'var(--ink-3)', strokeDasharray: '4 5', strokeWidth: 1.5 }} />
      {[40, 70, 100, 130].map((y) => (
        <path key={y} d={`M24 ${y}H196`} style={{ stroke: 'var(--ink-3)', strokeDasharray: '2 6', strokeWidth: 1.5 }} />
      ))}
      <g transform="translate(60 44) scale(1.6)">
        <path d={CARET} style={{ stroke: 'var(--ink-3)', strokeWidth: 2 }} />
      </g>
    </svg>
  );
}

export function EmptyState({ sketch, title, children, action, headingLevel: Heading = 'h2', className }: EmptyStateProps) {
  const art = sketch === 'words' ? <EmptySketchWords /> : sketch === 'journal' ? <EmptySketchJournal /> : sketch;
  return (
    <div className={cx('mx-auto grid max-w-[560px] justify-items-center gap-4 py-16 text-center', className)}>
      {art ? <div className="mb-4">{art}</div> : null}
      <Heading className="font-title text-[26px] leading-[1.15] font-bold text-balance text-ink">{title}</Heading>
      <p className="max-w-[46ch] text-ui leading-normal text-ink-2">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
