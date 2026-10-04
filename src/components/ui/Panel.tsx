import type { ElementType, ReactNode } from 'react';
import { cx } from './cx';

export interface PanelProps {
  children: ReactNode;
  /** Header row content (mono, uppercase). With `variant="sheet"` it is inverted like a call sheet. */
  head?: ReactNode;
  foot?: ReactNode;
  variant?: 'flat' | 'raised' | 'sheet';
  as?: ElementType;
  className?: string;
  bodyClassName?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** Surface container. Use `variant="sheet"` for call-sheet styled structured info. */
export function Panel({
  children,
  head,
  foot,
  variant = 'flat',
  as: Tag = 'section',
  className,
  bodyClassName,
  ...aria
}: PanelProps) {
  return (
    <Tag
      className={cx(
        'gl-panel',
        variant === 'raised' && 'gl-panel--raised',
        variant === 'sheet' && 'gl-panel--sheet',
        className,
      )}
      {...aria}
    >
      {head ? <div className="gl-panel__head">{head}</div> : null}
      <div className={cx('gl-panel__body', bodyClassName)}>{children}</div>
      {foot ? <div className="gl-panel__foot">{foot}</div> : null}
    </Tag>
  );
}

/** A Card is a raised Panel rendered as a div. */
export function Card(props: Omit<PanelProps, 'variant'>) {
  return <Panel as="div" variant="raised" {...props} />;
}
