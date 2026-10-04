import type { ReactNode } from 'react';
import { APP_NAME } from '@/config/brand';
import { LAUNCH_DATE } from '@/config/game';
import { cx } from '@/components/ui/cx';

const ROLL = LAUNCH_DATE.slice(0, 4);

/**
 * A length of leader as a horizontal strip with perforations and edge print. `head` sits at the
 * top of the page above the nav, `tail` brackets the footer. Decorative: aria-hidden.
 */
export function LeaderStrip({
  kind,
  left,
  right,
  className,
}: {
  kind: 'head' | 'tail';
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cx('gl-strip', kind === 'head' ? 'gl-strip--head' : 'gl-strip--tail perfs', className)}
    >
      <span className="gl-strip__group">
        {left ?? (
          <>
            {kind === 'head' ? 'Head' : 'Tail'} ▸ {APP_NAME} ▸ Roll {ROLL}
          </>
        )}
      </span>
      <span className="gl-strip__group">{right ?? (kind === 'head' ? 'Picture start' : 'End of reel')}</span>
    </div>
  );
}
