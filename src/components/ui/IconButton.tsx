import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

interface IconCommon {
  /** Accessible name. Required: the icon itself is decorative. */
  label: string;
  icon: ReactNode;
  size?: 'sm' | 'md';
  outline?: boolean;
}

const cls = (size: 'sm' | 'md' = 'md', outline = false, extra?: string) =>
  cx('gl-icon-btn', size === 'sm' && 'gl-icon-btn--sm', outline && 'gl-icon-btn--outline', extra);

export function IconButton({
  label,
  icon,
  size,
  outline,
  className,
  type = 'button',
  ...rest
}: IconCommon & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type={type} aria-label={label} title={label} className={cls(size, outline, className)} {...rest}>
      {icon}
    </button>
  );
}

export function IconLink({
  label,
  icon,
  size,
  outline,
  className,
  href,
  ...rest
}: IconCommon & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'> & { href: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={cls(size, outline, className)} {...rest}>
      {icon}
    </Link>
  );
}
