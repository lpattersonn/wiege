'use client';

import { Segmented } from '@/components/ui/Segmented';

import { setThemePref, usePrefs } from './hooks';
import type { ThemePref } from './theme';

/**
 * System | Light | Dark, saved on this device (footer, settings). Applies
 * immediately, updates the browser chrome colour and other open tabs.
 */
export function ThemeSwitch({ showLegend = false, className }: { showLegend?: boolean; className?: string }) {
  const prefs = usePrefs();
  return (
    <Segmented<ThemePref>
      legend="Theme"
      showLegend={showLegend}
      value={prefs?.theme ?? null}
      onChange={setThemePref}
      className={className}
      options={[
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
    />
  );
}
