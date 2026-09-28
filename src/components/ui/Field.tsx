import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { IconAlert, IconChevronDown } from '@/components/glyphs/icons';

import { cx } from './cx';

/**
 * Form fields (DESIGN §11.2). Label above (15px 700, 8px gap), helper below
 * (14px --ink-3), 1.5px --line-control border, 12px radius, Atkinson 18px.
 * Errors: 2px --ink border, the hatch strip on the left inner edge, and a
 * message row starting with what to do, linked by aria-describedby.
 */
export interface FieldChromeProps {
  label: ReactNode;
  /** Keep the label for screen readers only (search fields). */
  hideLabel?: boolean;
  helper?: ReactNode;
  /** Error text; say what to do ("Type clear to confirm."). Sets aria-invalid. */
  error?: ReactNode;
  className?: string;
}

export function fieldControlClasses(invalid: boolean, extra?: string, tone: 'ui' | 'draft' = 'ui'): string {
  return cx(
    'block w-full rounded-control bg-paper outline-offset-3 transition-[border-color] duration-160',
    tone === 'draft' ? 'max-w-[36em] font-read text-[19px] leading-[1.9] text-ink-read md:text-[20px]' : 'font-ui text-choice text-ink',
    'hover:border-ink focus-visible:border-ink focus-visible:outline-3 focus-visible:outline-ink',
    'disabled:cursor-not-allowed disabled:border-dashed disabled:text-ink-3 disabled:hover:border-line-control',
    invalid ? 'border-2 border-ink pl-6' : 'border-[1.5px] border-line-control',
    extra,
  );
}

/** Label + control + helper/error rows. `children` receives the ids to wire up. */
export function FieldChrome({
  label,
  hideLabel = false,
  helper,
  error,
  className,
  id,
  children,
}: FieldChromeProps & { id: string; children: (ids: { describedBy: string | undefined; invalid: boolean }) => ReactNode }) {
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('grid gap-2', className)}>
      <label htmlFor={id} className={cx('text-small leading-snug font-bold text-ink', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        {children({ describedBy, invalid: Boolean(error) })}
        {error ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-2 rounded-l-[10px]"
            style={{ background: 'repeating-linear-gradient(135deg, var(--ink-3) 0 1.5px, transparent 1.5px 5px)' }}
          />
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="flex items-start gap-2 text-small leading-snug font-semibold text-ink">
          <IconAlert className="mt-px" />
          <span>{error}</span>
        </p>
      ) : null}
      {helper ? (
        <p id={helperId} className="text-caption leading-snug text-ink-3">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export type TextInputProps = FieldChromeProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & { inputClassName?: string };

/** Text input, 48px tall. Placeholder never replaces the label. */
export function TextInput({ label, hideLabel, helper, error, className, inputClassName, id: idProp, ...input }: TextInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldChrome id={id} label={label} hideLabel={hideLabel} helper={helper} error={error} className={className}>
      {({ describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={fieldControlClasses(invalid, cx('min-h-12 px-4', inputClassName))}
          {...input}
        />
      )}
    </FieldChrome>
  );
}

export type TextareaProps = FieldChromeProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
    /** 'ui' (Atkinson 18) or 'draft' (Literata 20/1.9, 19 on mobile — the writing editor). */
    tone?: 'ui' | 'draft';
    textareaClassName?: string;
  };

export function Textarea({ label, hideLabel, helper, error, className, tone = 'ui', textareaClassName, id: idProp, rows = 5, ...rest }: TextareaProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldChrome id={id} label={label} hideLabel={hideLabel} helper={helper} error={error} className={className}>
      {({ describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={fieldControlClasses(invalid, cx('resize-y px-5 py-4', textareaClassName), tone)}
          {...rest}
        />
      )}
    </FieldChrome>
  );
}

export type SelectProps = FieldChromeProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'>;

/** Native select for more than 4 options (rare). Never a custom listbox. */
export function Select({ label, hideLabel, helper, error, className, id: idProp, children, ...rest }: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldChrome id={id} label={label} hideLabel={hideLabel} helper={helper} error={error} className={className}>
      {({ describedBy, invalid }) => (
        <>
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={fieldControlClasses(invalid, 'min-h-12 cursor-pointer appearance-none pr-12 pl-4')}
            {...rest}
          >
            {children}
          </select>
          <IconChevronDown className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2" />
        </>
      )}
    </FieldChrome>
  );
}
