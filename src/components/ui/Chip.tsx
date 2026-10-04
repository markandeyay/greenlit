import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { StatusGlyph } from './StatusGlyph';

export interface ChipProps {
  children: ReactNode;
  /** Status fill for genre chips: green with a check, or gray. Never decorative. */
  status?: 'match' | 'miss';
  /** Ruled-out style (strikethrough), as in the Call Sheet's CUT. */
  cut?: boolean;
  className?: string;
}

/** A static chip. */
export function Chip({ children, status, cut, className }: ChipProps) {
  return (
    <span className={cx('gl-chip', status && 'gl-status', cut && 'gl-chip--cut', className)} data-verdict={status}>
      {status ? <StatusGlyph verdict={status} /> : null}
      {children}
    </span>
  );
}

/** A pressable filter chip (aria-pressed). */
export function ToggleChip({
  pressed,
  children,
  className,
  ...rest
}: { pressed: boolean; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" aria-pressed={pressed} className={cx('gl-chip', className)} {...rest}>
      {pressed ? <span aria-hidden="true">✓</span> : null}
      {children}
    </button>
  );
}
