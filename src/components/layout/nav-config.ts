import type { IconName } from '@/components/glyphs/icons';

/** The five app destinations (SPEC §8, DESIGN §11.8). Never more than five. */
export interface AppDestination {
  href: string;
  label: string;
  icon: IconName;
  /** Extra path prefixes that count as this destination (e.g. /c/games → Explore). */
  match?: string[];
}

export const APP_DESTINATIONS: readonly AppDestination[] = [
  { href: '/today', label: 'Today', icon: 'today' },
  { href: '/c', label: 'Explore', icon: 'explore' },
  { href: '/words', label: 'Words', icon: 'words' },
  { href: '/journal', label: 'Journal', icon: 'journal' },
  { href: '/me', label: 'Me', icon: 'me', match: ['/settings'] },
];

/** Landing / info nav text links (max three). */
export const SITE_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/#stories', label: 'Today’s stories' },
  { href: '/#how', label: 'How it works' },
  { href: '/parents', label: 'For parents and teachers' },
];

export const FOOTER_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/today', label: 'Today' },
  { href: '/about', label: 'About' },
  { href: '/c', label: 'Explore' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/words', label: 'Your words' },
  { href: '/parents', label: 'Parents and teachers' },
];

export function isCurrent(pathname: string | null, dest: AppDestination): boolean {
  if (!pathname) return false;
  const prefixes = [dest.href, ...(dest.match ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
