'use client';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Accessible name for the tablist. */
  label: string;
  /** Controlled value. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
}

/**
 * WAI-ARIA tabs with roving tabindex. Arrow Left / Right move and activate, Home / End jump.
 * Edge-print styling: frame lines between tabs, a Carolina bar under the selected one.
 */
export function Tabs({ tabs, label, value, defaultValue, onChange, className }: TabsProps) {
  const base = useId();
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.id ?? '');
  const selected = value ?? internal;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (id: string, focusIndex?: number) => {
    if (value === undefined) setInternal(id);
    onChange?.(id);
    if (focusIndex !== undefined) refs.current[focusIndex]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = tabs.length;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    select(tabs[next]!.id, next);
  };

  return (
    <div className={cx('gl-tabs', className)}>
      <div role="tablist" aria-label={label} className="gl-tabs__list">
        {tabs.map((t, i) => {
          const isSel = t.id === selected;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={isSel}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={isSel ? 0 : -1}
              className="gl-tabs__tab"
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== selected}
          tabIndex={0}
          className="gl-tabs__panel"
        >
          {t.id === selected ? t.content : null}
        </div>
      ))}
    </div>
  );
}
