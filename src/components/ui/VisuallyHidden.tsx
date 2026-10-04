import type { ElementType, ReactNode } from 'react';

/** Content for screen readers only. Pass `focusable` for skip-style links that appear on focus. */
export function VisuallyHidden({
  children,
  as: Tag = 'span',
  focusable = false,
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  focusable?: boolean;
  id?: string;
}) {
  return (
    <Tag id={id} className={focusable ? 'sr-only-focusable' : 'sr-only'}>
      {children}
    </Tag>
  );
}
