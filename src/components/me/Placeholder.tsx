import type { ReactNode } from 'react';

import { cx } from '@/components/ui/cx';

/**
 * A skeleton that takes exactly the space of `sizer` (rendered invisibly in
 * the same font), so an on-device value can replace it without any layout
 * shift (DESIGN §11.18). Always aria-hidden.
 */
export function Placeholder({ sizer, className }: { sizer: ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('relative inline-block max-w-full align-baseline', className)}>
      <span className="invisible">{sizer}</span>
      <span className="skeleton absolute inset-x-0 top-[18%] bottom-[18%]" />
    </span>
  );
}
