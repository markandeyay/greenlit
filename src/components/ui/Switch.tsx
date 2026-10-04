'use client';
import { useId, type ReactNode } from 'react';
import { cx } from './cx';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Visible state words, so state never relies on the thumb position alone. */
  onText?: string;
  offText?: string;
  className?: string;
}

/** role="switch" toggle with a visible ON / OFF word. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  onText = 'On',
  offText = 'Off',
  className,
}: SwitchProps) {
  const labelId = useId();
  const descId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('gl-switch', className)}
    >
      <span className="gl-switch__track" aria-hidden="true">
        <span className="gl-switch__thumb" />
      </span>
      <span className="gl-switch__state" aria-hidden="true">
        {checked ? onText : offText}
      </span>
      <span className="grid">
        <span id={labelId}>{label}</span>
        {description ? (
          <span id={descId} className="text-ink-dim text-sm">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** Alias. */
export const Toggle = Switch;
