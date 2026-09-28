/**
 * Theme plumbing shared by the root layout's blocking script, ThemeSync and
 * any theme control. Isomorphic: no store import (keeps zod out of every page).
 *
 * The preference lives in the on-device store (`localStorage['wiege:v1']`,
 * `prefs.theme`). 'system' removes `data-theme`, so the CSS media query decides.
 */
export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_EVENT = 'wiege:theme';
const STORAGE_KEY = 'wiege:v1';

/**
 * Runs in <head> before first paint (≈ 200 bytes). Sets data-theme only for an
 * explicit light/dark choice; anything else falls through to the system scheme.
 */
export const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("${STORAGE_KEY}")||"null"),t=s&&s.prefs&&s.prefs.theme;if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readStoredTheme(): ThemePref {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const theme = raw ? (JSON.parse(raw) as { prefs?: { theme?: unknown } } | null)?.prefs?.theme : null;
    return theme === 'light' || theme === 'dark' ? theme : 'system';
  } catch {
    return 'system';
  }
}

/** Applies a theme to <html> and the browser chrome colour. Browser only. */
export function applyTheme(theme: ThemePref): void {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((meta) => {
    if (!meta.dataset.systemColor) meta.dataset.systemColor = meta.content;
    meta.content = theme === 'system' ? meta.dataset.systemColor : theme === 'dark' ? '#000000' : '#FFFFFF';
  });
}

/** Tell ThemeSync (and other tabs via the store's storage event) about a change. */
export function announceTheme(theme: ThemePref): void {
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent<ThemePref>(THEME_EVENT, { detail: theme }));
}
