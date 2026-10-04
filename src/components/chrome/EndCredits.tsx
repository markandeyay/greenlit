import type { ReactNode } from 'react';
import { cx } from '@/components/ui/cx';

export interface CreditRow {
  role: string;
  name: ReactNode;
}

/** A credit roll: role right, name left, meeting at the centre gutter (SFA roll). */
export function EndCredits({ rows, className }: { rows: readonly CreditRow[]; className?: string }) {
  return (
    <dl className={cx('gl-roll', className)}>
      {rows.map((r) => (
        <div className="gl-roll__row" key={r.role}>
          <dt className="gl-roll__role">{r.role}</dt>
          <dd className="gl-roll__name">{r.name}</dd>
        </div>
      ))}
    </dl>
  );
}
