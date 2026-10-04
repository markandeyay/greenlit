'use client';
// Keyboard-first autocomplete over a short, known list (the current actor's films, or a film's
// cast). ARIA 1.2 combobox with an inline listbox: type to filter, Up / Down to move, Enter to
// pick, Escape to clear. Disabled options stay visible with their reason.
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { cx } from '@/components/ui/cx';
import { normalizeForSearch } from '@/lib/search';

export interface PickerOption {
  id: number;
  label: string;
  /** Extra searchable text, e.g. the year. */
  keywords?: string;
  meta?: ReactNode;
  thumb?: ReactNode;
  disabled?: boolean;
  /** Spoken and shown when disabled, e.g. "already on the call sheet". */
  note?: string;
}

export interface OptionPickerProps {
  label: string;
  placeholder: string;
  options: PickerOption[];
  onSelect: (id: number) => void;
  busy?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  emptyText: string;
  testId?: string;
  /** Hide the visible label (a heading above already says it); it stays the accessible name. */
  hideLabel?: boolean;
}

function matches(o: PickerOption, q: string): boolean {
  if (!q) return true;
  const hay = normalizeForSearch(`${o.label} ${o.keywords ?? ''}`);
  return q.split(' ').every((w) => hay.split(' ').some((h) => h.startsWith(w)));
}

export function OptionPicker({ label, placeholder, options, onSelect, busy = false, inputRef, emptyText, testId, hideLabel = false }: OptionPickerProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);

  const visible = useMemo(() => {
    const q = normalizeForSearch(query);
    return options.filter((o) => matches(o, q));
  }, [options, query]);

  const enabledIdx = visible.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const activeIdx = enabledIdx.includes(active) ? active : -1;

  const move = (step: 1 | -1) => {
    if (enabledIdx.length === 0) return;
    const pos = enabledIdx.indexOf(activeIdx);
    const next = pos < 0 ? (step === 1 ? 0 : enabledIdx.length - 1) : (pos + step + enabledIdx.length) % enabledIdx.length;
    setActive(enabledIdx[next]!);
  };

  const pick = (o: PickerOption | undefined) => {
    if (!o || o.disabled || busy) return;
    onSelect(o.id);
    setQuery('');
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0) pick(visible[activeIdx]);
      else if (enabledIdx.length === 1) pick(visible[enabledIdx[0]!]);
    } else if (e.key === 'Escape') {
      if (query) {
        e.preventDefault();
        setQuery('');
        setActive(-1);
      }
    }
  };

  return (
    <div data-testid={testId}>
      <label htmlFor={`${id}-input`} className={hideLabel ? 'sr-only' : 'ty-label mb-2 block'}>
        {label}
      </label>
      <input
        id={`${id}-input`}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIdx >= 0 ? `${id}-opt-${visible[activeIdx]!.id}` : undefined}
        aria-busy={busy || undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={query}
        readOnly={busy}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        className="min-h-11 w-full rounded-full border border-rule bg-surface px-4 py-2 text-base text-ink placeholder:text-ink-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        className="mt-3 max-h-[min(26rem,60vh)] overflow-y-auto rounded-[var(--radius-lg)] border border-rule bg-surface shadow-[var(--shadow-sm)]"
      >
        {visible.length === 0 ? (
          <li role="presentation" className="px-3 py-3 text-ink-dim">
            {query ? 'No match in this list.' : emptyText}
          </li>
        ) : (
          visible.map((o, i) => (
            <li
              key={o.id}
              id={`${id}-opt-${o.id}`}
              role="option"
              aria-selected={i === activeIdx}
              aria-disabled={o.disabled || undefined}
              aria-label={o.note ? `${o.label}, ${o.note}` : undefined}
              data-option-id={o.id}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onClick={() => pick(o)}
              className={cx(
                'flex min-h-16 items-center gap-3 border-b border-rule px-3 py-2.5 last:border-b-0',
                o.disabled ? 'cursor-not-allowed text-ink-dim' : 'cursor-pointer hover:bg-surface-2',
                i === activeIdx && 'bg-surface-2 outline-2 -outline-offset-2 outline-ink',
              )}
            >
              {o.thumb}
              <span className="min-w-0 flex-1">
                <span className={cx('block text-[17px] leading-tight font-semibold break-words', o.disabled && 'font-normal line-through')}>{o.label}</span>
                {o.meta ? <span className="mt-0.5 block text-sm text-ink-dim">{o.meta}</span> : null}
              </span>
              {o.disabled && o.note ? (
                <span className="shrink-0 text-xs text-ink-dim">{o.note}</span>
              ) : (
                <span aria-hidden="true" className="shrink-0 text-xl text-ink-dim">
                  ›
                </span>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
