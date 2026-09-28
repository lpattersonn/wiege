import type { ElementType, HTMLAttributes } from 'react';

/** Text for screen readers only (Tailwind's `sr-only`). */
export function VisuallyHidden({ as: Tag = 'span', className, ...rest }: HTMLAttributes<HTMLElement> & { as?: ElementType }) {
  return <Tag className={className ? `sr-only ${className}` : 'sr-only'} {...rest} />;
}
