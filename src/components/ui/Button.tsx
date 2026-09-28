import Link from 'next/link';
import type { AnchorHTMLAttributes, ComponentProps, ReactNode } from 'react';

import { cx } from './cx';

/**
 * Buttons (DESIGN §11.1). Pills you press. One filled (primary) action per
 * viewport. Sizes: L 48px (default), S 40px with a 44px hit area; `block`
 * fills the width (mobile sheets and bars). Loading keeps the width and swaps
 * the label; disabled is dashed, never faded.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'lg' | 'sm';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

const BASE =
  'relative inline-flex items-center justify-center gap-2 font-ui font-bold whitespace-nowrap no-underline cursor-pointer select-none ' +
  'transition-[background-color,color,border-color,text-decoration-thickness,transform] duration-160 ease-out active:translate-y-px ' +
  'disabled:cursor-not-allowed disabled:active:translate-y-0 aria-disabled:cursor-not-allowed';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'rounded-pill border-[1.5px] border-ink bg-ink text-paper hover:border-ink-2 hover:bg-ink-2 ' +
    'in-[.inv]:border-paper in-[.inv]:bg-paper in-[.inv]:text-ink in-[.inv]:hover:border-sheet in-[.inv]:hover:bg-sheet ' +
    'disabled:border-dashed disabled:border-line-control disabled:bg-transparent disabled:text-ink-3 disabled:hover:bg-transparent',
  secondary:
    'rounded-pill border-[1.5px] border-ink bg-transparent text-ink hover:bg-sheet ' +
    'in-[.inv]:border-paper in-[.inv]:text-paper in-[.inv]:hover:bg-ink-2 ' +
    'disabled:border-dashed disabled:border-line-control disabled:text-ink-3 disabled:hover:bg-transparent',
  ghost:
    'min-h-11 rounded-paper px-0 text-ink underline decoration-2 underline-offset-[5px] hover:decoration-[3px] ' +
    'disabled:text-ink-3 disabled:decoration-dashed',
};

const SIZES: Record<ButtonSize, string> = {
  lg: 'min-h-12 px-6 text-ui leading-none',
  // 40px visual, 44px hit area via the ::before extension.
  sm: "min-h-10 px-4 text-nav leading-none before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
};

export function buttonClasses({ variant = 'primary', size = 'lg', block = false, className }: ButtonStyleOptions = {}): string {
  return cx(BASE, VARIANTS[variant], variant !== 'ghost' && SIZES[size], variant === 'ghost' && (size === 'sm' ? 'text-nav' : 'text-ui'), block && 'w-full', className);
}

export interface ButtonProps extends ComponentProps<'button'>, ButtonStyleOptions {
  /** Leading icon (20px). */
  icon?: ReactNode;
  /** Shows `loadingLabel` in place of the label, keeps the width, sets aria-busy. Pass it (true/false) on buttons that can load, so the width is reserved from the start. */
  loading?: boolean;
  loadingLabel?: string;
}

/** Keeps the button's width fixed while its label swaps (loading, saved). */
function SwapLabel({ children, alt, showAlt }: { children: ReactNode; alt: ReactNode; showAlt: boolean }) {
  return (
    <span className="inline-grid">
      <span className={cx('[grid-area:1/1]', showAlt && 'invisible')} aria-hidden={showAlt || undefined}>
        {children}
      </span>
      <span className={cx('[grid-area:1/1]', !showAlt && 'invisible')} aria-hidden={!showAlt || undefined}>
        {alt}
      </span>
    </span>
  );
}

export function Button({ variant, size, block, className, icon, loading, loadingLabel = 'Saving…', children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, block, className })} aria-busy={loading || undefined} {...rest}>
      {icon}
      {loading === undefined ? (
        children
      ) : (
        <SwapLabel alt={loadingLabel} showAlt={loading}>
          {children}
        </SwapLabel>
      )}
    </button>
  );
}

export interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, 'className'>, ButtonStyleOptions {
  icon?: ReactNode;
}

/** A link styled as a button (navigation: "Start reading", "Read this story"). */
export function LinkButton({ variant, size, block, className, icon, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** Same look for plain anchors (downloads, mailto, external). */
export function AnchorButton({ variant, size, block, className, icon, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & ButtonStyleOptions & { icon?: ReactNode }) {
  return (
    <a className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </a>
  );
}

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label'> {
  /** Accessible name, e.g. "Say rehearse out loud". Required: the icon is the only content. */
  label: string;
  icon: ReactNode;
  /** No visible border (e.g. the back button in the reader bar). */
  bare?: boolean;
  /** Toggle state: inverts and sets aria-pressed. */
  pressed?: boolean;
}

/** 44px circular icon button (DESIGN §11.1 Icon): say it, listen, settings, close, search, menu. */
export function IconButton({ label, icon, bare = false, pressed, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={cx(
        'inline-grid size-11 shrink-0 cursor-pointer place-items-center rounded-pill border-[1.5px] text-ink transition-[background-color,border-color,transform] duration-160 ease-out active:translate-y-px',
        bare ? 'border-transparent hover:bg-sheet' : 'border-line-control hover:border-ink hover:bg-sheet',
        pressed && 'border-ink bg-ink text-paper hover:bg-ink-2',
        'disabled:cursor-not-allowed disabled:border-dashed disabled:text-ink-3',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}

export { SwapLabel };
