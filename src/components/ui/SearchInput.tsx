'use client';

import { useId, useRef, type InputHTMLAttributes, type KeyboardEvent } from 'react';

import { IconClose, IconSearch } from '@/components/glyphs/icons';

import { cx } from './cx';
import { fieldControlClasses } from './Field';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  /** Accessible label, visually hidden by default ("Search your words"). */
  label: string;
  showLabel?: boolean;
  className?: string;
}

/** Sets a React-controlled input's value and fires the input event, so onChange runs. */
function clearInput(input: HTMLInputElement) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Search field (DESIGN §11.2): 20px search icon inside on the left,
 * type="search", Esc clears. A 44px "Clear search" button appears while
 * there is text.
 */
export function SearchInput({ label, showLabel = false, className, id: idProp, onKeyDown, placeholder, ...rest }: SearchInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const ref = useRef<HTMLInputElement>(null);
  const hasValue = typeof rest.value === 'string' ? rest.value.length > 0 : undefined;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.key === 'Escape' && event.currentTarget.value) {
      event.preventDefault();
      clearInput(event.currentTarget);
    }
  }

  return (
    <div className={cx('grid gap-2', className)}>
      <label htmlFor={id} className={cx('text-small font-bold', !showLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-2" />
        <input
          ref={ref}
          id={id}
          type="search"
          autoComplete="off"
          placeholder={placeholder ?? label}
          onKeyDown={handleKeyDown}
          className={fieldControlClasses(
            false,
            'min-h-12 pr-12 pl-12 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
          )}
          {...rest}
        />
        {hasValue ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute top-1/2 right-0.5 inline-grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-pill text-ink-2 hover:bg-sheet hover:text-ink"
            onClick={() => {
              if (ref.current) {
                clearInput(ref.current);
                ref.current.focus();
              }
            }}
          >
            <IconClose />
          </button>
        ) : null}
      </div>
    </div>
  );
}
