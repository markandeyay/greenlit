'use client';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { IconClose } from './icons';
import { cx } from './cx';
import { useIsClient } from './useIsClient';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true',
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row. */
  actions?: ReactNode;
  /** Slate bar text above the title, e.g. "Sc 02 · Tk 04". */
  bar?: ReactNode;
  /** Element to focus on open; defaults to the first focusable control. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
  wide?: boolean;
  /** Clicking the scrim closes. Default true (false for alertdialog). */
  closeOnBackdrop?: boolean;
  /** Hide the corner close button. */
  hideClose?: boolean;
  className?: string;
}

/**
 * Accessible modal dialog: role="dialog" + aria-modal, labelled by its title, focus moves in
 * and is trapped (Tab / Shift+Tab cycle), Escape closes, focus returns to the opener, and
 * page scroll is locked while open. Rendered in a portal on document.body.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  bar,
  initialFocusRef,
  role = 'dialog',
  wide = false,
  closeOnBackdrop,
  hideClose = false,
  className,
}: DialogProps) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !isClient) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    if (panel) {
      const target = initialFocusRef?.current ?? focusables(panel)[0] ?? panel;
      target.focus();
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [open, isClient, initialFocusRef]);

  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = focusables(panel);
    if (items.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!open || !isClient) return null;
  const backdropCloses = closeOnBackdrop ?? role !== 'alertdialog';

  return createPortal(
    <div
      className="gl-dialog-backdrop"
      onMouseDown={(e) => {
        if (backdropCloses && e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx('gl-dialog', wide && 'gl-dialog--wide', className)}
        onKeyDown={onKeyDown}
      >
        <div className="gl-dialog__bar">
          <span aria-hidden="true">{bar ?? 'Sc -- · Tk --'}</span>
          {hideClose ? null : (
            <IconButton label="Close" size="sm" icon={<IconClose />} onClick={() => onCloseRef.current()} />
          )}
        </div>
        <div className="gl-dialog__body">
          <h2 id={titleId} className="gl-dialog__title">
            {title}
          </h2>
          {description ? (
            <div id={descId} className="gl-dialog__desc">
              {description}
            </div>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
        {actions ? <div className="gl-dialog__actions">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Visual weight of the confirm button. "danger" for destructive actions like Walk away. */
  tone?: 'default' | 'danger';
  bar?: ReactNode;
}

/** Yes / no confirmation as an alertdialog. Focus starts on Cancel (the safe choice). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'default',
  bar,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      role="alertdialog"
      initialFocusRef={cancelRef}
      bar={bar}
      hideClose
      actions={
        <>
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'solid'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
