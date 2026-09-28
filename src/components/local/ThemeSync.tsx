'use client';

import { useLayoutEffect } from 'react';

import { applyTheme, readStoredTheme, THEME_EVENT, type ThemePref } from './theme';

/**
 * Keeps `<html data-theme>` in step with the stored preference: after React's
 * dev remount (which clears attributes the head script set), when another tab
 * changes the theme, and when a theme control announces a change. Renders
 * nothing. Mounted once in the root layout.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readStoredTheme());
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'wiege:v1' || event.key === null) applyTheme(readStoredTheme());
    };
    const onTheme = (event: Event) => applyTheme((event as CustomEvent<ThemePref>).detail);
    window.addEventListener('storage', onStorage);
    window.addEventListener(THEME_EVENT, onTheme);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(THEME_EVENT, onTheme);
    };
  }, []);
  return null;
}
