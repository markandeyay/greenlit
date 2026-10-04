import type { ReactNode } from 'react';
import { cx } from '@/components/ui/cx';

/**
 * The one compact title block for content pages: a display h1 (one italic accent word at most)
 * and an optional one or two sentence lede. Nothing decorative above it.
 */
export function PageHeader({
  title,
  lede,
  children,
  className,
}: {
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('gl-pagehead', className)}>
      <h1 className="gl-pagehead__title ty-display">{title}</h1>
      {lede ? <p className="gl-pagehead__lede">{lede}</p> : null}
      {children}
    </header>
  );
}
