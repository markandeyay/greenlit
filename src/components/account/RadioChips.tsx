'use client';
import type { ReactNode } from 'react';

export interface RadioChipOption<T extends string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
}

/**
 * A native radio group drawn as chips. Arrow keys move between options (browser behavior),
 * the selected chip inverts AND shows a check, so state never relies on color alone.
 */
export function RadioChips<T extends string>({
  name,
  legend,
  description,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: ReactNode;
  description?: ReactNode;
  options: readonly RadioChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="ty-label mb-1">{legend}</legend>
      {description ? <p className="text-sm text-ink-dim">{description}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className="gl-chip cursor-pointer select-none has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
              />
              <span aria-hidden="true" className="inline-block w-[1ch]">
                {checked ? '✓' : ''}
              </span>
              <span>{o.label}</span>
              {o.hint ? <span className="font-normal normal-case opacity-75">{o.hint}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
