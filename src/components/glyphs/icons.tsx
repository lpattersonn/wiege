import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  Clock,
  Download,
  Ellipsis,
  EyeOff,
  LayoutGrid,
  Lock,
  Menu,
  NotebookText,
  Pause,
  Plus,
  Search,
  Smartphone,
  Trash2,
  Type,
  Upload,
  User,
  Volume2,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { SVGProps } from 'react';

/**
 * UI icons (DESIGN §7): lucide-react at 20px, strokeWidth 1.8, round caps
 * and joins, outline only (no filled variants), mapped to the names §7 lists.
 * They render as static SVG in server components; only icons inside client
 * islands reach the browser bundle. Decorative by default (aria-hidden); pass
 * `title` when the icon is the only label (prefer a visible label or an
 * aria-label on the button instead).
 *
 * Category glyphs are not here: they are the hand-drawn set in CategoryGlyph.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'ref'> {
  /** Rendered size in px (default 20; 22 in the tab bar, 18 in meta rows). */
  size?: number;
  strokeWidth?: number;
  /** Accessible name. Omit for decorative icons. */
  title?: string;
}

function makeIcon(name: string, Lucide: LucideIcon) {
  function Icon({ size = 20, strokeWidth = 1.8, title, className, ...rest }: IconProps) {
    return (
      <Lucide
        size={size}
        strokeWidth={strokeWidth}
        focusable="false"
        className={className ? `shrink-0 ${className}` : 'shrink-0'}
        {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
        data-icon={name}
        {...rest}
      >
        {title ? <title>{title}</title> : null}
      </Lucide>
    );
  }
  Icon.displayName = `Icon${name}`;
  return Icon;
}

export const IconToday = makeIcon('Today', CalendarDays);
export const IconExplore = makeIcon('Explore', LayoutGrid);
export const IconWords = makeIcon('Words', NotebookText);
export const IconJournal = makeIcon('Journal', BookOpen);
export const IconMe = makeIcon('Me', User);
export const IconSearch = makeIcon('Search', Search);
export const IconClock = makeIcon('Clock', Clock);
export const IconSpeak = makeIcon('Speak', Volume2);
export const IconPlus = makeIcon('Plus', Plus);
export const IconClose = makeIcon('Close', X);
export const IconBack = makeIcon('Back', ChevronLeft);
export const IconMenu = makeIcon('Menu', Menu);
export const IconTick = makeIcon('Tick', Check);
export const IconLock = makeIcon('Lock', Lock);
export const IconDevice = makeIcon('Device', Smartphone);
export const IconEyeOff = makeIcon('EyeOff', EyeOff);
export const IconAa = makeIcon('Aa', Type);
export const IconAlert = makeIcon('Alert', CircleAlert);
export const IconDownload = makeIcon('Download', Download);
export const IconUpload = makeIcon('Upload', Upload);
export const IconTrash = makeIcon('Trash', Trash2);
export const IconChevronDown = makeIcon('ChevronDown', ChevronDown);
/** External-link marker for "Read the original at …" (the ↗ in DESIGN §12.4), never a right arrow after a link. */
export const IconExternal = makeIcon('External', ArrowUpRight);
export const IconPause = makeIcon('Pause', Pause);
export const IconMore = makeIcon('More', Ellipsis);

export const ICONS = {
  today: IconToday,
  explore: IconExplore,
  words: IconWords,
  journal: IconJournal,
  me: IconMe,
  search: IconSearch,
  clock: IconClock,
  speak: IconSpeak,
  plus: IconPlus,
  close: IconClose,
  back: IconBack,
  menu: IconMenu,
  tick: IconTick,
  lock: IconLock,
  device: IconDevice,
  'eye-off': IconEyeOff,
  aa: IconAa,
  alert: IconAlert,
  download: IconDownload,
  upload: IconUpload,
  trash: IconTrash,
  'chevron-down': IconChevronDown,
  external: IconExternal,
  pause: IconPause,
  more: IconMore,
} as const;

export type IconName = keyof typeof ICONS;

/** Name-addressed icon, for data-driven lists (nav config, tab bar). */
export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = ICONS[name];
  return <Component {...props} />;
}
