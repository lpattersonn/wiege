'use client';

import { IconAlert } from '@/components/glyphs/icons';
import { cx } from '@/components/ui/cx';

import { usePersistent } from './hooks';

/**
 * Shown only when this browser can't keep progress (private mode, blocked
 * storage): DESIGN §10 "Storage unavailable". Renders nothing otherwise.
 */
export function PersistenceNotice({ className }: { className?: string }) {
  const persistent = usePersistent();
  if (persistent !== false) return null;
  return (
    <p role="status" className={cx('flex items-start gap-2 rounded-paper border border-line-soft p-4 text-small leading-snug text-ink', className)}>
      <IconAlert className="mt-px" />
      <span>Progress can’t be saved in this browser mode. Open Wiege in a normal window to keep your words.</span>
    </p>
  );
}
