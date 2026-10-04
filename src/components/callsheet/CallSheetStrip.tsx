'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { COPY } from '@/config/brand';
import { computeCallSheet } from '@/lib/callsheet';
import { CallSheet, type CallSheetProps } from './CallSheet';

export interface CallSheetStripProps extends Omit<CallSheetProps, 'variant' | 'state'> {
  /** Start expanded (default false). */
  defaultExpanded?: boolean;
  /** Classes for the sticky wrapper. Defaults include `lg:hidden` (mobile only). */
  className?: string;
}

/**
 * Mobile Call Sheet (Section 6.5): a sticky collapsible strip under the search,
 * "CALL SHEET · 4 confirmed ▾" on one line, that expands to the full sheet.
 * Disclosure button with aria-expanded / aria-controls; focus moves into the sheet on expand;
 * Escape collapses and returns focus to the button.
 */
export function CallSheetStrip({ defaultExpanded = false, className, ...sheetProps }: CallSheetStripProps) {
  const [open, setOpen] = useState(defaultExpanded);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanelOnOpen = useRef(false);
  const state = useMemo(() => computeCallSheet(sheetProps.feedback), [sheetProps.feedback]);
  const n = state.counts.confirmed;

  useEffect(() => {
    if (open && focusPanelOnOpen.current) {
      focusPanelOnOpen.current = false;
      panelRef.current?.focus();
    }
  }, [open]);

  const toggle = () => {
    focusPanelOnOpen.current = !open;
    setOpen(!open);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div
      onKeyDown={onKeyDown}
      className={className ?? 'sticky top-0 z-20 lg:hidden'}
      data-expanded={open || undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={[
          'flex min-h-[44px] w-full items-center justify-between gap-3 border border-rule bg-surface px-3.5 py-2 text-left text-ink',
          open ? 'rounded-t-[var(--radius-lg)]' : 'rounded-[var(--radius-lg)]',
        ].join(' ')}
      >
        <span className="flex min-w-0 items-baseline gap-2 text-[14px]">
          <span className="font-display text-[15px] font-bold tracking-wide">{COPY.callSheet}</span>
          <span aria-hidden="true" className="text-ink-dim">·</span>
          <span className="tabular-nums text-ink-dim">{n} confirmed</span>
        </span>
        <span aria-hidden="true" className={['inline-block text-ink-dim motion-safe:transition-transform', open ? 'rotate-180' : ''].join(' ')}>
          ▾
        </span>
        <span className="sr-only">{open ? 'Collapse' : 'Expand'}</span>
      </button>
      <div
        id={panelId}
        ref={panelRef}
        tabIndex={-1}
        hidden={!open}
        aria-label={`${COPY.callSheet} details`}
        role="region"
        className="max-h-[70vh] overflow-y-auto overscroll-contain rounded-b-[var(--radius-lg)] border border-t-0 border-rule bg-surface shadow-[var(--shadow-md)] outline-none focus-visible:outline-2 focus-visible:outline-ink"
      >
        {open ? <CallSheet {...sheetProps} state={state} variant="drawer" className="border-b-0" /> : null}
      </div>
    </div>
  );
}
