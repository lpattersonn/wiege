'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cx } from './cx';

/**
 * Popover (DESIGN §11.20 desktop reading settings, z 70): a panel under its
 * trigger with a 1.5px --ink edge and 12px radius. Uses the native popover
 * API for the top layer, light dismiss and Esc; positioned by script against
 * the trigger (aligned to its end by default) and kept inside the viewport.
 *
 *   <Popover label="Reading settings" trigger={(p) => <IconButton {...p} label="Reading settings" icon={<IconAa />} />}>
 *     <ReadingSettings … />
 *   </Popover>
 */
export interface PopoverTriggerProps {
  'aria-expanded': boolean;
  'aria-controls': string;
  popoverTarget: string;
}

export interface PopoverProps {
  /** Accessible name of the panel. */
  label: string;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  /** Panel width in px (320). */
  width?: number;
  align?: 'start' | 'end';
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({ label, trigger, children, width = 320, align = 'end', className, onOpenChange }: PopoverProps) {
  const id = useId().replace(/:/g, '');
  const panelId = `popover-${id}`;
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const place = useCallback(() => {
    const panel = panelRef.current;
    const anchor = document.querySelector<HTMLElement>(`[popovertarget="${panelId}"]`);
    if (!panel || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const w = Math.min(width, window.innerWidth - 16);
    const left = align === 'end' ? rect.right - w : rect.left;
    panel.style.width = `${w}px`;
    panel.style.left = `${Math.max(8, Math.min(left, window.innerWidth - w - 8))}px`;
    const top = Math.min(rect.bottom + 8, window.innerHeight - 160);
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${Math.max(160, window.innerHeight - top - 16)}px`;
  }, [align, width, panelId]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onToggle = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === 'open';
      setOpen(isOpen);
      onOpenChange?.(isOpen);
      if (isOpen) place();
    };
    const onBeforeToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === 'open') place();
    };
    panel.addEventListener('toggle', onToggle);
    panel.addEventListener('beforetoggle', onBeforeToggle);
    return () => {
      panel.removeEventListener('toggle', onToggle);
      panel.removeEventListener('beforetoggle', onBeforeToggle);
    };
  }, [place, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, { capture: true });
    };
  }, [open, place]);

  return (
    <>
      {trigger({ 'aria-expanded': open, 'aria-controls': panelId, popoverTarget: panelId })}
      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label={label}
        className={cx('popover-panel z-70 overflow-y-auto overscroll-contain rounded-control border-[1.5px] border-ink bg-paper p-5 text-ink', className)}
      >
        {children}
      </div>
    </>
  );
}
