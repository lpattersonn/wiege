import type { ReactNode } from 'react';

import { cx } from './cx';
import { Segmented } from './Segmented';

/**
 * Reading settings panel (DESIGN §11.20), controlled. Put it in a <Popover>
 * under the Aa button on desktop (320px) or in a modal <Sheet> on mobile.
 * A live preview sentence sits at the top; each row is a label plus a
 * segmented control. Changes apply immediately: persist them with
 * `dispatch({ type: 'setPrefs', prefs: patch })` and, for the theme, call
 * `announceTheme()` from components/local/theme.
 *
 * Not a 'use client' module on purpose: server pages call
 * `readingPrefsAttributes()` for the story wrapper, and a function exported
 * from a client module reaches the server only as a reference it can't call.
 * The panel itself is interactive through <Segmented>, and its `onChange`
 * means it always sits inside a client parent.
 */
export type ReadingFont = 'book' | 'clear';
export type TextSize = 's' | 'm' | 'l' | 'xl';
export type LineSpacing = 'normal' | 'relaxed' | 'loose';
export type ThemeChoice = 'system' | 'light' | 'dark';

export interface ReadingSettingsValue {
  readingFont: ReadingFont;
  textSize: TextSize;
  lineSpacing: LineSpacing;
  theme: ThemeChoice;
}

/** Data attributes that make `.type-read` text follow the settings. Spread them on the story wrapper. */
export function readingPrefsAttributes(value: Pick<ReadingSettingsValue, 'readingFont' | 'textSize' | 'lineSpacing'>) {
  return {
    'data-reading-font': value.readingFont,
    'data-text-size': value.textSize,
    'data-line-spacing': value.lineSpacing,
  } as const;
}

export interface ReadingSettingsProps {
  value: ReadingSettingsValue;
  onChange: (patch: Partial<ReadingSettingsValue>) => void;
  /** Hide the theme row (e.g. when the page has its own theme control). */
  showTheme?: boolean;
  preview?: string;
  /** Extra rows at the end, e.g. the reader's "Look up a word" field. */
  children?: ReactNode;
  className?: string;
}

export function ReadingSettings({
  value,
  onChange,
  showTheme = true,
  preview = 'Runners study a level frame by frame, then practise the hardest trick until their hands know it by heart.',
  children,
  className,
}: ReadingSettingsProps) {
  return (
    <div className={cx('grid gap-6', className)}>
      <div {...readingPrefsAttributes(value)} className="rounded-paper bg-sheet p-4">
        <p className="type-read max-w-none!">
          <span className="sr-only">Preview: </span>
          {preview}
        </p>
      </div>
      <Segmented
        legend="Font"
        showLegend
        block
        value={value.readingFont}
        onChange={(readingFont) => onChange({ readingFont })}
        options={[
          { value: 'book', label: 'Book' },
          { value: 'clear', label: 'Clear' },
        ]}
      />
      <Segmented
        legend="Size"
        showLegend
        block
        value={value.textSize}
        onChange={(textSize) => onChange({ textSize })}
        options={[
          { value: 's', label: 'S', ariaLabel: 'Small' },
          { value: 'm', label: 'M', ariaLabel: 'Medium' },
          { value: 'l', label: 'L', ariaLabel: 'Large' },
          { value: 'xl', label: 'XL', ariaLabel: 'Extra large' },
        ]}
      />
      <Segmented
        legend="Line spacing"
        showLegend
        block
        value={value.lineSpacing}
        onChange={(lineSpacing) => onChange({ lineSpacing })}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'relaxed', label: 'Relaxed' },
          { value: 'loose', label: 'Loose' },
        ]}
      />
      {showTheme ? (
        <Segmented
          legend="Theme"
          showLegend
          block
          value={value.theme}
          onChange={(theme) => onChange({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      ) : null}
      {children}
    </div>
  );
}
