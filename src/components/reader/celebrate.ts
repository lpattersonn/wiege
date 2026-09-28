import { toast } from '@/components/ui/Toast';
import { BADGES } from '@/lib/progress/badges';
import type { LocalEvents } from '@/lib/local/reducers';

/**
 * One toast per student action (DESIGN §11.16): what happened, then any new
 * stamp or level the reducer awarded. Copy per DESIGN §10: plain, specific,
 * no exclamation marks.
 */
export function stampNames(events: LocalEvents): string[] {
  return events.newBadges.map((id) => BADGES.find((b) => b.id === id)?.name ?? id);
}

export function awardsText(events: LocalEvents): string {
  const parts: string[] = [];
  const stamps = stampNames(events);
  if (stamps.length === 1) parts.push(`New stamp: ${stamps[0]}.`);
  else if (stamps.length > 1) parts.push(`New stamps: ${stamps.join(', ')}.`);
  if (events.levelUp) parts.push(`You’re now a ${events.levelUp.name}.`);
  return parts.join(' ');
}

let warnedNotSaved = false;

/**
 * Shows `lead` plus any awards. When this browser can't keep progress
 * (private mode), says so once instead, since the save only lasts this visit.
 */
export function announce(lead: string, events: LocalEvents, action?: { label: string; onAction: () => void }): void {
  if (!warnedNotSaved && !isPersistent()) {
    warnedNotSaved = true;
    toast({
      tone: 'error',
      message: 'Progress can’t be saved in this browser mode. Open Wiege in a normal window to keep your words.',
      duration: 8000,
    });
    return;
  }
  const extra = awardsText(events);
  toast({ message: extra ? `${lead} ${extra}` : lead, action });
}

function isPersistent(): boolean {
  try {
    // Same probe the store uses: private modes and blocked site data throw here.
    window.localStorage.setItem('wiege:probe', '1');
    window.localStorage.removeItem('wiege:probe');
    return true;
  } catch {
    return false;
  }
}
