import Link from 'next/link';
import type { ReactNode } from 'react';

import { EmptySketchJournal } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/Button';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/**
 * Static pieces shared by /journal/[id] and /journal/new: the folio-style
 * frame (meta in the left margin from 1280px), the editor skeleton, and the
 * "not on this device" state. Server-safe.
 */

/** Left margin (meta) + the editor, which lays its notes out in its own right column. */
export function EntryFrame({ meta, children }: { meta: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-8 xl:grid-cols-[216px_minmax(0,1fr)] xl:gap-12">
      <div className="min-w-0">{meta}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Meta list for the margin: label/value pairs, 15px. */
export function EntryMeta({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 text-small xl:grid xl:content-start xl:gap-4">
      {items.map((item) => (
        <div key={item.label} className="grid gap-0.5">
          <dt className="text-caption text-ink-3">{item.label}</dt>
          <dd className="font-semibold text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Same-size placeholder for an entry while the store (and the story's prompts) load. */
export function EntrySkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-8 xl:grid-cols-[216px_minmax(0,1fr)] xl:gap-12">
      <div className="flex flex-wrap gap-8 xl:grid xl:content-start xl:gap-4">
        <Skeleton width={120} height={40} />
        <Skeleton width={160} height={40} />
      </div>
      <div className="grid max-w-[36em] gap-5">
        <SkeletonText lines={2} lineHeight={32} />
        <Skeleton height={340} className="rounded-control!" />
        <Skeleton width={220} height={22} />
        <Skeleton width={260} height={48} round />
      </div>
    </div>
  );
}

/** The entry isn't in this browser's journal (the h1 already says so). */
export function EntryMissing() {
  return (
    <div className="grid max-w-[560px] justify-items-start gap-6 py-6">
      <EmptySketchJournal />
      <p className="max-w-[46ch] text-ui leading-normal text-ink-2">
        Journal entries live in the browser where they were written. Open Wiege there to keep writing, or save a backup file on that device and restore it here in{' '}
        <Link href="/settings">Settings</Link>.
      </p>
      <LinkButton href="/journal">Back to your journal</LinkButton>
    </div>
  );
}

export const ENTRY_TITLE_FALLBACK = 'Journal entry';
export const ENTRY_TITLE_MISSING = 'This entry isn’t on this device.';
export const ENTRY_TITLE_FREE = 'Free write';
