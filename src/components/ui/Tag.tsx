import type { ReactNode } from 'react';
import { cx } from './cx';

/** Small mono corner label: LEAD, SUPP, US. Information, never a status color. */
export function Tag({
  children,
  tone = 'line',
  title,
  className,
}: {
  children: ReactNode;
  tone?: 'line' | 'solid' | 'dim';
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cx('gl-tag', tone === 'solid' && 'gl-tag--solid', tone === 'dim' && 'gl-tag--dim', className)}
    >
      {children}
    </span>
  );
}
