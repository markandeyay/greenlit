import Link from 'next/link';
import { Fragment } from 'react';
import { cx } from '@/components/ui/cx';

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Edge-print breadcrumb with chevrons: APP ▸ 2026 ▸ 212A. The last crumb is the current page.
 * Pass `decorative` when it is pure edge print (no links), so it is hidden from assistive tech.
 */
export function Breadcrumb({
  items,
  label = 'Breadcrumb',
  decorative = false,
  className,
}: {
  items: readonly Crumb[];
  label?: string;
  decorative?: boolean;
  className?: string;
}) {
  const list = (
    <ol>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={`${c.label}-${i}`}>
            <li>
              {c.href && !last ? (
                <Link href={c.href}>{c.label}</Link>
              ) : (
                <span aria-current={last && !decorative ? 'page' : undefined}>{c.label}</span>
              )}
              {!last ? (
                <span className="gl-crumbs__sep" aria-hidden="true">
                  ▸
                </span>
              ) : null}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
  if (decorative) {
    return (
      <div aria-hidden="true" className={cx('gl-crumbs', className)}>
        {list}
      </div>
    );
  }
  return (
    <nav aria-label={label} className={cx('gl-crumbs', className)}>
      {list}
    </nav>
  );
}
