'use client';

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';

import { IconClose } from '@/components/glyphs/icons';

import { IconButton } from './Button';
import { cx } from './cx';

/**
 * Bottom sheet (DESIGN §11.9). --paper with a 1.5px --ink top edge, 20px top
 * radius, 40×4 grab handle, 20px padding plus the safe area, max 50svh with
 * internal scroll, a 44px close button top-right. 560px centred on tablets.
 *
 * - `modal={false}` (word notes): no scrim, the page stays scrollable and
 *   tappable; Esc closes; focus goes to `initialFocusRef` on open and back to
 *   `returnFocusRef` on close. Publishes its height as `--sheet-h` on <html>
 *   so the reader can pad its bottom and toasts sit above it.
 * - `modal` (reading settings, destructive confirms): a native <dialog> with
 *   scrim, focus trap and focus restore.
 *
 * Swipe down on the handle, Esc, or the close button all call `onClose`.
 */
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  modal?: boolean;
  /** Id of the heading that names the sheet (the headword for word notes). */
  labelledBy?: string;
  /** Accessible name when there is no visible heading. */
  label?: string;
  /** Close button label ("Close word note"). */
  closeLabel?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  id?: string;
  /** Override the 50svh cap (e.g. '85svh' for a settings sheet). */
  maxHeight?: string;
  className?: string;
  children: ReactNode;
}

function useSwipeToClose(onClose: () => void) {
  const start = useRef<{ y: number; id: number } | null>(null);
  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      start.current = { y: event.clientY, id: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (!start.current || start.current.id !== event.pointerId) return;
      const dy = Math.max(0, event.clientY - start.current.y);
      const panel = event.currentTarget.closest<HTMLElement>('.sheet-panel');
      if (panel) panel.style.transform = dy ? `translateY(${dy}px)` : '';
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      if (!start.current) return;
      const dy = event.clientY - start.current.y;
      start.current = null;
      const panel = event.currentTarget.closest<HTMLElement>('.sheet-panel');
      if (panel) panel.style.transform = '';
      if (dy > 80) onClose();
    },
    onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
      start.current = null;
      const panel = event.currentTarget.closest<HTMLElement>('.sheet-panel');
      if (panel) panel.style.transform = '';
    },
  };
}

function SheetBody({ children, onClose, closeLabel, swipe }: { children: ReactNode; onClose: () => void; closeLabel: string; swipe: ReturnType<typeof useSwipeToClose> }) {
  return (
    <>
      <div className="-mx-5 -mt-2 flex h-6 shrink-0 cursor-grab touch-none items-start justify-center pt-2" aria-hidden="true" {...swipe}>
        <span className="h-1 w-10 rounded-pill bg-line-control" />
      </div>
      <IconButton label={closeLabel} icon={<IconClose />} onClick={onClose} className="absolute top-3 right-3 z-1 bg-paper" />
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-1">{children}</div>
    </>
  );
}

export function Sheet({
  open,
  onClose,
  modal = false,
  labelledBy,
  label,
  closeLabel = 'Close',
  initialFocusRef,
  returnFocusRef,
  id,
  maxHeight,
  className,
  children,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const swipe = useSwipeToClose(onClose);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Modal: drive the native dialog.
  useEffect(() => {
    if (!modal) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [modal, open, initialFocusRef]);

  // Non-modal: focus in and out, Esc, and the --sheet-h variable.
  useEffect(() => {
    if (modal) return;
    const panel = panelRef.current;
    if (open) {
      wasOpen.current = true;
      initialFocusRef?.current?.focus({ preventScroll: true });
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onCloseRef.current();
      };
      document.addEventListener('keydown', onKey);
      const root = document.documentElement;
      const observer = panel ? new ResizeObserver(() => root.style.setProperty('--sheet-h', `${panel.offsetHeight}px`)) : null;
      if (panel && observer) observer.observe(panel);
      return () => {
        document.removeEventListener('keydown', onKey);
        observer?.disconnect();
        root.style.removeProperty('--sheet-h');
      };
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      returnFocusRef?.current?.focus({ preventScroll: true });
    }
  }, [modal, open, initialFocusRef, returnFocusRef]);

  const style = maxHeight ? { maxHeight } : undefined;

  if (modal) {
    return (
      <dialog
        ref={dialogRef}
        id={id}
        className={cx('sheet-panel', className)}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        style={style}
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
        {/* The dialog keeps its content mounted so the close transition has something to show. */}
        <SheetBody onClose={onClose} closeLabel={closeLabel} swipe={swipe}>
          {children}
        </SheetBody>
      </dialog>
    );
  }

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      data-open={open ? 'true' : 'false'}
      className={cx('sheet-panel', className)}
      style={style}
    >
      <SheetBody onClose={onClose} closeLabel={closeLabel} swipe={swipe}>
        {children}
      </SheetBody>
    </div>
  );
}
