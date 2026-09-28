'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { IconClose } from '@/components/glyphs/icons';
import { IconButton } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';

/**
 * Drawer (DESIGN §11.8): slides in from the right (280ms), full height,
 * min(360px, 88vw), --paper with a 1.5px --ink left edge, scrim at 40% ink.
 * A native modal <dialog>: focus is trapped, Esc and the scrim close it, and
 * focus returns to the button that opened it.
 */
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name ("Menu"). */
  label: string;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, label, id, className, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={id}
      aria-label={label}
      className={cx('drawer-panel', className)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-14 shrink-0 items-center justify-end px-3">
        <IconButton label={`Close ${label.toLowerCase()}`} icon={<IconClose />} onClick={onClose} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-[calc(24px+env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
